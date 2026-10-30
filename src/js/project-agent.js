import {emptyDraft, escapeHTML as esc, extension, extensions, allowedFileRoles, isImage, isModel, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, normalizeDraft, validateDraft} from './project-schema.js';
import {inspectGLB} from './glb.js';
import {apiRequest, resolveProjectMedia} from './project-api.js';

export function createProjectAgent({getLanguage, t, onPublished}) {
  const dialog = document.querySelector('#project-agent');
  let files = [], draft = emptyDraft(), notes = '', sourceFiles = [], busy = '', status = null, message = '', error = '', warnings = [], evidence = [], controller, idempotencyKey = crypto.randomUUID();
  let editLanguage = getLanguage();
  const sourceName = id => sourceFiles.find(file => file.id === id)?.name || files.find(file => file.id === id)?.name || id;
  const localized = text => text?.[editLanguage] || '';
  const fileBody = file => ({id: file.id, name: file.name, data: file.data, role: file.role, caption: file.caption});
  const fieldLabel = field => t({title: 'agentProjectTitle', destination: 'destination', studentName: 'explorers', origin: 'home', theme: 'theme', year: 'year', researchQuestion: 'researchQuestion', note: 'journeyNote', transport: 'agentTransport', fieldNotes: 'fieldNotes', researchNotes: 'thinkingTitle', unansweredQuestions: 'furtherQuestions', destinationCoords: 'agentCoordinates'}[field] || 'agentSource');
  const errText = code => t(agentErrorKeys[`agentError_${code}`] || 'agentError_serverError');
  // Known server codes map to localized messages; upstream error bodies never enter the page.
  const agentErrorKeys = Object.fromEntries(['invalidProject', 'invalidYear', 'invalidCoordinates', 'titleRequired', 'destinationRequired', 'fileCount', 'fileType', 'invalidFile', 'fileSize', 'textEncoding', 'imageRequired', 'invalidModel', 'modelResources', 'invalidArchive', 'archiveLimit', 'archiveEmpty', 'archiveUploadLimit', 'loginRequired', 'teacherRequired', 'invalidCSRF', 'publicationConflict', 'unreadableFile', 'emptyFiles', 'agentTimeout', 'agentUnavailable', 'agentBusy', 'invalidAgentResponse', 'adminNotConfigured', 'unauthorized', 'agentNotConfigured', 'duplicateRole', 'connectionError', 'serverError', 'originNotAllowed', 'invalidRequest'].map(code => [`agentError_${code}`, `agentError_${code}`]));

  function input(field, multiline = false) {
    return `<label class="agent-field ${multiline ? 'agent-wide' : ''}"><span>${esc(fieldLabel(field))}${['title', 'destination'].includes(field) ? ' *' : ''}</span>${multiline ? `<textarea rows="3" data-field="${field}" maxlength="12000">${esc(localized(draft[field]))}</textarea>` : `<input data-field="${field}" value="${esc(localized(draft[field]))}" maxlength="12000">`}</label>`;
  }
  function renderFiles() {
    return files.map(file => `<li class="agent-file"><div class="agent-file-preview">${file.preview ? `<img src="${file.preview}" alt="">` : `<span>${esc(extension(file.name).toUpperCase())}</span>`}</div><div class="agent-file-info"><strong>${esc(file.name)}</strong><small>${(file.size / 1024 / 1024).toFixed(2)} MB</small><select data-role="${file.id}" aria-label="${esc(t('agentFileRole'))}: ${esc(file.name)}">${allowedFileRoles(file).map(role => `<option value="${role}" ${file.role === role ? 'selected' : ''}>${esc(t(`agentRole_${role}`))}</option>`).join('')}</select><input data-caption="${file.id}" value="${esc(file.caption?.[editLanguage] || '')}" placeholder="${esc(t('agentCaption'))}" aria-label="${esc(t('agentCaption'))}: ${esc(file.name)}" maxlength="1000"></div><button type="button" data-remove="${file.id}" aria-label="${esc(t('agentRemoveFile'))}: ${esc(file.name)}">×</button></li>`).join('');
  }
  function render() {
    dialog.innerHTML = `<div class="agent-heading"><div><span class="eyebrow">DREAM JOURNEY / DEEPSEEK</span><h2 id="agent-title">${t('agentTitle')}</h2><p>${t('agentIntro')}</p></div><button class="agent-close" type="button" aria-label="${t('agentClose')}" ${busy === 'publishing' ? 'disabled' : ''}>×</button></div>
      <ol class="agent-steps"><li class="${files.length ? 'complete' : 'current'}"><b>01</b>${t('agentStepUpload')}</li><li class="${message === 'agentAnalyzed' ? 'complete' : 'current'}"><b>02</b>${t('agentStepReview')}</li><li><b>03</b>${t('agentStepPublish')}</li></ol>
      <p class="agent-connection ${status?.analysis ? 'ready' : ''}" role="status">${t(status === null ? 'agentConnecting' : status.error ? 'agentOffline' : !status.publishing ? 'teacherLoginRequired' : !status.analysis ? 'agentSetupModel' : 'agentReady')}</p>
      <div class="agent-workspace" aria-busy="${Boolean(busy)}"><section class="agent-upload"><h3>${t('agentUploadHeading')}</h3><label class="agent-dropzone" tabindex="0"><span class="agent-upload-symbol" aria-hidden="true">↥</span><strong>${t('agentDrop')}</strong><span>${t('agentFormats')}</span><small>${t('agentLimits')}</small><input id="agent-files" type="file" multiple accept="${extensions.map(ext => `.${ext}`).join(',')}" class="sr-only" ${busy ? 'disabled' : ''}></label><p class="agent-muted agent-model-hint">${t('agentModelHint')}</p><ul class="agent-files">${renderFiles()}</ul>
      <label class="agent-field"><span>${t('agentContext')}</span><textarea id="agent-context" rows="3" maxlength="5000" placeholder="${t('agentContextPlaceholder')}">${esc(notes)}</textarea></label>
      <button class="agent-primary agent-analyze" type="button" ${busy || !files.some(file => !isModel(file)) || !status?.analysis ? 'disabled' : ''}>✳ &nbsp; ${t(busy === 'analyzing' ? 'agentAnalyzing' : 'agentAnalyze')}</button><p class="agent-muted">${t('agentPrivacy')}</p></section>
      <section class="agent-review"><div class="agent-review-heading"><h3>${t('agentReviewHeading')}</h3><div class="agent-languages" role="group" aria-label="${t('agentEditLanguage')}"><button data-edit-language="zh" type="button" aria-pressed="${editLanguage === 'zh'}">中文</button><button data-edit-language="en" type="button" aria-pressed="${editLanguage === 'en'}">English</button></div></div><p class="agent-muted">${t('agentReviewHint')}</p>
      <form id="agent-form"><fieldset ${busy ? 'disabled' : ''}><div class="agent-grid">${input('title')}${input('destination')}${input('studentName')}${input('theme')}${input('origin')}${input('transport')}
      <label class="agent-field"><span>${t('year')}</span><input type="number" id="agent-year" min="1900" max="2200" value="${draft.year ?? ''}"></label>
      <div class="agent-field"><span>${t('agentOriginCoordinates')}</span><div class="agent-coordinate-inputs"><input id="agent-origin-lat" type="number" step="any" min="18" max="53" placeholder="${t('agentLatitude')}" aria-label="${t('agentOriginCoordinates')} · ${t('agentLatitude')}" value="${draft.originCoords?.lat ?? ''}"><input id="agent-origin-lng" type="number" step="any" min="73" max="135" placeholder="${t('agentLongitude')}" aria-label="${t('agentOriginCoordinates')} · ${t('agentLongitude')}" value="${draft.originCoords?.lng ?? ''}"></div></div>
      <div class="agent-field"><span>${t('agentCoordinates')}</span><div class="agent-coordinate-inputs"><input id="agent-lat" type="number" step="any" min="18" max="53" placeholder="${t('agentLatitude')}" aria-label="${t('agentCoordinates')} · ${t('agentLatitude')}" value="${draft.destinationCoords?.lat ?? ''}"><input id="agent-lng" type="number" step="any" min="73" max="135" placeholder="${t('agentLongitude')}" aria-label="${t('agentCoordinates')} · ${t('agentLongitude')}" value="${draft.destinationCoords?.lng ?? ''}"></div></div>
      ${input('researchQuestion', true)}${input('note', true)}${input('fieldNotes', true)}</div>
      <details class="agent-detail"><summary>${t('agentResearchStages')}</summary>${t('agentStagesHint')}<div class="agent-stage-fields">${t('agentStageNames').split('|').map((name, i) => `<label class="agent-field"><span>${String(i + 1).padStart(2, '0')} / ${name}</span><textarea data-stage-input="${i}" rows="2" maxlength="12000">${esc(localized(draft.researchNotes[i]))}</textarea></label>`).join('')}</div></details>
      <label class="agent-field"><span>${t('furtherQuestions')} · ${t('agentOnePerLine')}</span><textarea id="agent-questions" rows="3" maxlength="12000">${esc(draft.unansweredQuestions.map(localized).join('\n'))}</textarea></label></fieldset></form>
      ${sourceFiles.length ? `<details class="agent-detail"><summary>${t('agentParsedFiles')} (${sourceFiles.length})</summary><ul>${sourceFiles.map(file => `<li>${esc(file.name)}</li>`).join('')}</ul></details>` : ''}<div class="agent-warnings">${warnings.length ? `<strong>${t('agentWarnings')}</strong><ul>${warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul>` : ''}</div>
      ${evidence.length ? `<details class="agent-detail"><summary>${t('agentEvidence')} (${evidence.length})</summary>${evidence.map(item => `<blockquote><small>${esc(fieldLabel(item.field))} · ${esc(sourceName(item.source))}</small><p>${esc(item.quote)}</p></blockquote>`).join('')}</details>` : ''}
      </section></div><div class="agent-feedback" role="status" aria-live="polite">${error ? `<p class="agent-error" role="alert">${esc(errText(error))}</p>` : message ? `<p>${t(message)}</p>` : ''}</div>
      <div class="agent-footer"><p>${t('agentPublicNote')}</p><button class="agent-secondary agent-reset" type="button" ${busy ? 'disabled' : ''}>${t('agentReset')}</button><button class="agent-primary agent-publish" type="submit" form="agent-form" ${busy || !status?.publishing ? 'disabled' : ''}>${t(busy === 'publishing' ? 'agentPublishing' : 'agentPublish')} ↗</button></div>`;
    bind();
  }
  async function addFiles(selected) {
    if (busy) return;
    error = ''; message = '';
    const incoming = [...selected];
    if (files.length + incoming.length > MAX_FILES) { error = 'fileCount'; render(); return; }
    if ([...files, ...incoming].filter(isModel).length > 1) { error = 'duplicateRole'; render(); return; }
    if (incoming.some(file => !extensions.includes(extension(file.name)))) { error = 'fileType'; render(); return; }
    if (incoming.some(file => !file.size || file.size > MAX_FILE_BYTES) || [...files, ...incoming].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) { error = 'fileSize'; render(); return; }
    busy = 'reading'; render();
    try {
      for (const file of incoming) {
        if (extension(file.name) === 'zip') {
          const encoded = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
          const expanded = await apiRequest('api/files/expand', {body: {files: [{id: crypto.randomUUID(), name: file.name, role: 'reference', data: encoded}]}});
          if (files.length + expanded.files.length > MAX_FILES || [...files, ...expanded.files].reduce((sum, item) => sum + item.size, 0) > MAX_TOTAL_BYTES) throw new Error('archiveUploadLimit');
          files.push(...expanded.files.map(item => ({...item, preview: isImage(item) ? `data:${item.mime};base64,${item.data}` : '', role: isImage(item) ? 'field' : 'reference', caption: {zh: '', en: ''}})));
          if (!files.some(item => item.role === 'cover')) { const first = files.find(isImage); if (first) first.role = 'cover'; }
          warnings.push(...(expanded.warnings || []));
          continue;
        }
        if (isModel(file)) inspectGLB(new Uint8Array(await file.arrayBuffer()));
        const dataURL = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        files.push({id: crypto.randomUUID(), name: file.name, size: file.size, data: dataURL.split(',')[1], preview: isImage(file) ? URL.createObjectURL(file) : '', role: isModel(file) ? 'model' : isImage(file) ? files.some(item => item.role === 'cover') ? 'field' : 'cover' : 'reference', caption: {zh: '', en: ''}});
      }
    } catch (err) { error = ['invalidModel', 'modelResources', 'invalidArchive', 'archiveLimit', 'archiveEmpty', 'archiveUploadLimit', 'loginRequired', 'teacherRequired', 'invalidCSRF'].includes(err.message) ? err.message : 'invalidFile'; }
    finally { busy = ''; render(); }
  }
  function bind() {
    dialog.querySelector('.agent-close').onclick = () => dialog.close();
    dialog.querySelector('#agent-files').onchange = event => addFiles(event.target.files);
    const drop = dialog.querySelector('.agent-dropzone');
    drop.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); dialog.querySelector('#agent-files').click(); } };
    drop.ondragover = event => { event.preventDefault(); drop.classList.add('dragover'); };
    drop.ondragleave = () => drop.classList.remove('dragover');
    drop.ondrop = event => { event.preventDefault(); addFiles(event.dataTransfer.files); };
    dialog.querySelector('#agent-context').oninput = event => { notes = event.target.value; };
    for (const element of dialog.querySelectorAll('[data-field]')) element.oninput = () => { draft[element.dataset.field][editLanguage] = element.value; };
    for (const element of dialog.querySelectorAll('[data-stage-input]')) element.oninput = () => { const index = Number(element.dataset.stageInput); draft.researchNotes[index] ??= {zh: '', en: ''}; draft.researchNotes[index][editLanguage] = element.value; };
    dialog.querySelector('#agent-year').oninput = event => { draft.year = event.target.value === '' ? null : Number(event.target.value); };
    const coordinate = (field, prefix) => {
      const lat = dialog.querySelector(`#agent-${prefix}lat`).value, lng = dialog.querySelector(`#agent-${prefix}lng`).value;
      draft[field] = !lat && !lng ? null : {lat: lat === '' ? NaN : Number(lat), lng: lng === '' ? NaN : Number(lng)};
    };
    const destinationCoordinate = () => coordinate('destinationCoords', ''), originCoordinate = () => coordinate('originCoords', 'origin-');
    dialog.querySelector('#agent-lat').oninput = destinationCoordinate; dialog.querySelector('#agent-lng').oninput = destinationCoordinate;
    dialog.querySelector('#agent-origin-lat').oninput = originCoordinate; dialog.querySelector('#agent-origin-lng').oninput = originCoordinate;
    dialog.querySelector('#agent-questions').oninput = event => {
      const lines = event.target.value.split('\n').slice(0, 20), previous = draft.unansweredQuestions;
      draft.unansweredQuestions = Array.from({length: Math.max(lines.length, previous.length)}, (_, i) => ({zh: '', en: '', ...previous[i], [editLanguage]: lines[i] || ''}));
    };
    for (const button of dialog.querySelectorAll('[data-edit-language]')) button.onclick = () => { editLanguage = button.dataset.editLanguage; render(); };
    for (const button of dialog.querySelectorAll('[data-remove]')) button.onclick = () => {
      if (busy) return;
      const file = files.find(item => item.id === button.dataset.remove); if (file.preview) URL.revokeObjectURL(file.preview);
      files = files.filter(item => item !== file); evidence = evidence.filter(item => item.source !== file.id); render();
    };
    for (const select of dialog.querySelectorAll('[data-role]')) select.onchange = () => {
      if (busy) return;
      const file = files.find(item => item.id === select.dataset.role);
      if (['cover', 'report', 'notebook', 'reflection'].includes(select.value)) files.filter(item => item !== file && item.role === select.value).forEach(item => { item.role = 'reference'; });
      file.role = select.value; render();
    };
    for (const input of dialog.querySelectorAll('[data-caption]')) input.oninput = () => { files.find(file => file.id === input.dataset.caption).caption[editLanguage] = input.value; };
    dialog.querySelector('.agent-analyze').onclick = analyze;
    dialog.querySelector('#agent-form').onsubmit = publish;
    dialog.querySelector('.agent-reset').onclick = reset;
    if (busy) for (const input of dialog.querySelectorAll('.agent-upload input, .agent-upload select, .agent-upload textarea, [data-remove], [data-edit-language]')) input.disabled = true;
  }
  function showError(code) { error = code; render(); dialog.querySelector('.agent-feedback').scrollIntoView({block: 'nearest'}); }
  async function analyze() {
    if (busy) return;
    busy = 'analyzing'; error = ''; message = 'agentAnalyzing'; controller = new AbortController(); render();
    try {
      const result = await apiRequest('api/agent/analyze', {signal: controller.signal, body: {files: files.filter(file => !isModel(file)).map(fileBody), notes}});
      draft = normalizeDraft(result.project); sourceFiles = result.sourceFiles || []; warnings = result.warnings || []; evidence = result.evidence || [];
      const used = new Set();
      for (const suggestion of result.fileRoles || []) {
        const file = files.find(item => item.id === suggestion.id);
        if (!file || !allowedFileRoles(file).includes(suggestion.role)) continue;
        if (['cover', 'report', 'notebook', 'reflection'].includes(suggestion.role)) {
          if (used.has(suggestion.role)) continue;
          used.add(suggestion.role);
          files.filter(other => other !== file && other.role === suggestion.role).forEach(other => { other.role = 'reference'; });
        }
        file.role = suggestion.role; file.caption = suggestion.caption || {zh: '', en: ''};
      }
      message = 'agentAnalyzed';
    } catch (err) { if (err.name !== 'AbortError') error = err.message; message = ''; }
    finally { busy = ''; render(); }
  }
  async function publish(event) {
    event.preventDefault(); if (busy) return;
    try { draft = validateDraft(draft); } catch (err) { showError(err.message); return; }
    busy = 'publishing'; error = ''; message = 'agentPublishing'; render();
    try {
      const result = await apiRequest('api/projects', {body: {idempotencyKey, project: draft, files: files.map(fileBody)}});
      if (!result.project?.id) throw new Error('serverError');
      const published = resolveProjectMedia(result.project);
      busy = ''; dialog.close(); reset(); onPublished(published);
    } catch (err) { busy = ''; showError(err.message); }
  }
  function reset() {
    for (const file of files) if (file.preview) URL.revokeObjectURL(file.preview);
    files = []; draft = emptyDraft(); notes = ''; warnings = []; evidence = []; sourceFiles = []; error = ''; message = ''; idempotencyKey = crypto.randomUUID(); render();
  }
  dialog.addEventListener('cancel', event => { if (busy === 'publishing') event.preventDefault(); });
  dialog.addEventListener('close', () => { if (busy === 'analyzing') controller?.abort(); });
  return {
    async open() {
      if (dialog.open) return;
      editLanguage = getLanguage(); render(); dialog.showModal();
      try { status = await apiRequest('api/agent/status'); } catch { status = {error: true}; }
      render();
    },
    refreshLocale() { if (dialog.open) render(); },
    clear() { controller?.abort(); if (dialog.open) dialog.close(); busy = ''; reset(); }
  };
}
