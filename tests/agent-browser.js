import {emptyDraft} from '../src/js/project-schema.js';
const frame = document.querySelector('iframe'), output = document.querySelector('#results');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (predicate()) return; await wait(40); }
  throw new Error(`Timed out: ${label}`);
}
document.querySelector('#run').onclick = async () => {
  output.textContent = ''; output.className = '';
  const check = (value, name) => { if (!value) throw new Error(name); output.textContent += `PASS ${name}\n`; };
  let originalFetch;
  try {
    await until(() => frame.contentDocument?.querySelector('.globe')?.dataset.ready, 'startup');
    const doc = frame.contentDocument, win = frame.contentWindow;
    originalFetch = win.fetch.bind(win);
    let submitted, analyzeCount = 0, savedCount = 0;
    win.fetch = async (url, init) => {
      if (String(url).endsWith('/api/projects') && !init?.method) return win.Response.json({projects: []});
      if (String(url).endsWith('/api/agent/status')) return win.Response.json({publishing: true, analysis: true, provider: 'DeepSeek', model: 'deepseek-flash'});
      if (String(url).endsWith('/api/agent/analyze')) {
        analyzeCount++;
        const body = JSON.parse(init.body);
        check(init.credentials === 'include' && Boolean(init.headers['X-CSRF-Token']), 'Analysis uses the teacher session cookie and CSRF protection');
        check(body.files.length === 4 && body.files.every(file => file.data.length), 'Only documents and images reach analysis; the GLB is excluded');
        return win.Response.json({project: {...emptyDraft(), title: {zh: '敦煌石窟研学', en: 'Dunhuang study'}, destination: {zh: '敦煌', en: 'Dunhuang'}, researchQuestion: {zh: '壁画为何褪色？', en: 'Why do murals fade?'}}, warnings: ['A test warning / 测试提示'], evidence: [{field: 'researchQuestion', source: body.files[0].id, quote: '壁画为何褪色？'}], fileRoles: [{id: body.files[0].id, role: 'report', caption: {zh: '研究报告', en: 'Research report'}}]});
      }
      if (String(url).endsWith('/api/projects') && init?.method === 'POST') {
        savedCount++; submitted = JSON.parse(init.body);
        const cover = submitted.files.find(file => file.role === 'cover');
        const model = submitted.files.find(file => file.role === 'model');
        return win.Response.json({project: {...submitted.project, id: `browser-check-${savedCount}`, createdAt: '2026-10-30T00:00:00Z', cover: cover ? `data:image/png;base64,${cover.data}` : '', fieldPhotos: [], model: model ? {src: new URL('fixtures/model.glb', document.baseURI).href, name: model.name, caption: {zh: '测试立方体', en: 'Test cube'}} : null, finalOutcomes: [{src: 'uploads/test/report.docx', name: 'research-notes.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', caption: {zh: '研究报告', en: 'Research report'}}, null, null]}}, {status: 201});
      }
      return originalFetch(url, init);
    };
    const fill = (selector, value) => { const input = doc.querySelector(selector); input.value = value; input.dispatchEvent(new win.Event('input', {bubbles: true})); };
    doc.querySelector('header [data-language="zh"]').click();
    await until(() => Boolean(doc.body.dataset.role), 'initial visitor state');
    if (doc.body.dataset.role !== 'visitor') {
      doc.querySelector('.entrance-actions [data-account]').click();
      doc.querySelector('.account-logout').click();
      await until(() => doc.body.dataset.role === 'visitor', 'reset test session');
    }
    check(doc.body.dataset.role === 'visitor' && doc.querySelector('#entrance-new-project').hidden, 'Visitors are the default and have no upload control');
    async function register(role) {
      doc.querySelector('.entrance-actions [data-account]').click();
      doc.querySelector('[data-mode="register"]').click();
      fill('#account-form [name="name"]', `Test ${role}`);
      const email = `${win.crypto.randomUUID()}@example.test`;
      fill('#account-form [name="email"]', email);
      fill('#account-form [name="password"]', 'browser-test-password');
      fill('#account-form [name="confirmation"]', 'browser-test-password');
      doc.querySelector(`#account-form [name="role"][value="${role}"]`).checked = true;
      doc.querySelector('.account-submit').click();
      await until(() => doc.body.dataset.role === role, `${role} registration`);
      return email;
    }
    await register('donor');
    check(doc.querySelector('#entrance-new-project').hidden, 'Donor registration enters donor mode without upload permission');
    await until(() => doc.querySelectorAll('.ss-map-marker').length === 4, 'donor sponsor stars');
    check(doc.querySelector('.ss-widget') && !doc.querySelector('.ss-panel').classList.contains('is-open'), 'Donor sees the quiet Sponsor Stars control linked to real destinations');
    doc.querySelector('[data-account-close]').click();
    doc.querySelector('.ss-map-marker[data-project-id="tulou"]').click();
    await until(() => doc.querySelector('#destination-gallery').open, 'sponsor destination gallery');
    check(win.location.hash === '#gallery/tulou', 'Sponsor Stars markers open their real destination galleries');
    doc.querySelector('.gallery-close').click();
    doc.querySelector('.entrance-actions [data-account]').click();
    doc.querySelector('.account-logout').click();
    await until(() => doc.body.dataset.role === 'visitor', 'donor logout');
    check(!doc.querySelector('.ss-widget'), 'Sponsor Stars is removed when the donor signs out');
    const teacherEmail = await register('teacher');
    doc.querySelector('.account-logout').click();
    await until(() => doc.body.dataset.role === 'visitor', 'teacher logout');
    doc.querySelector('.entrance-actions [data-account]').click();
    fill('#account-form [name="email"]', teacherEmail);
    fill('#account-form [name="password"]', 'browser-test-password');
    doc.querySelector('.account-submit').click();
    await until(() => doc.body.dataset.role === 'teacher', 'teacher sign-in');
    check(!doc.querySelector('#entrance-new-project').hidden, 'Teacher sign-in restores the account role and upload permission');
    check(!doc.querySelector('.ss-widget'), 'Sponsor Stars stays hidden for teacher accounts');
    doc.querySelector('[data-account-close]').click();
    check(!doc.querySelector('#entrance-new-project').hidden, 'Teacher registration and session enable the upload control');
    (doc.querySelector('#entrance-new-project') || doc.querySelector('#new-project')).click();
    await until(() => doc.querySelector('.agent-connection.ready'), 'assistant connection');
    check(doc.querySelector('#project-agent').open, 'Header opens an accessible project assistant dialog');
    const transfer = new win.DataTransfer();
    for (const [url, name, type] of [['fixtures/research-notes.docx', 'research-notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['../assets/images/journeys/dunhuang.png', 'dunhuang.png', 'image/png'], ['fixtures/model.glb', 'model.glb', 'model/gltf-binary'], ['fixtures/research-bundle.zip', 'research-bundle.zip', 'application/zip']]) {
      const buffer = await (await fetch(url)).arrayBuffer(); transfer.items.add(new win.File([buffer], name, {type}));
    }
    const input = doc.querySelector('#agent-files'); input.files = transfer.files; input.dispatchEvent(new win.Event('change', {bubbles: true}));
    await until(() => doc.querySelectorAll('.agent-file').length === 5 && !doc.querySelector('.agent-analyze').disabled, 'file reading');
    check(doc.querySelectorAll('.agent-file').length === 5 && doc.querySelector('.agent-files').textContent.includes('research-sheet.xlsx'), 'ZIP expands into separate reviewable Office files');
    check(doc.querySelector('.agent-file img') && doc.querySelector('select').value === 'reference', 'Images preview correctly and documents begin as private references');
    doc.querySelector('.agent-analyze').click();
    await until(() => doc.querySelector('[data-field="title"]').value === '敦煌石窟研学', 'DeepSeek autofill');
    check(analyzeCount === 1 && !doc.querySelector('.agent-publish').disabled, 'Successful analysis fills an editable, publishable draft');
    check(doc.querySelector('.agent-warnings').textContent.includes('测试提示') && doc.querySelector('.agent-detail blockquote').textContent.includes('research-notes.docx'), 'Warnings and source quotations are visible');
    check(doc.querySelector('select').value === 'report', 'Suggested outcome files are attached for review');
    fill('[data-field="title"]', '敦煌 <img src=x onerror=alert(1)>');
    doc.querySelector('[data-edit-language="en"]').click();
    check(doc.querySelector('[data-field="title"]').value === 'Dunhuang study', 'English draft is editable separately');
    fill('[data-field="title"]', 'Edited Dunhuang study');
    doc.querySelector('[data-edit-language="zh"]').click();
    check(doc.querySelector('[data-field="title"]').value.includes('<img'), 'Changing editing language retains draft changes');
    doc.querySelector('.agent-publish').click();
    await until(() => win.location.hash === '#explore' && doc.querySelector('.globe')?.dataset.ready && !doc.querySelector('#project-agent').open && !doc.querySelector('.project-opening'), 'publication returns to the main map');
    check(!doc.querySelector('#project-agent').open && !doc.querySelector('.project-opening'), 'Publication displays the new journey on the main interface');
    check(submitted.project.title.en === 'Edited Dunhuang study' && submitted.files.length === 5, 'Edited bilingual details and file roles reach publication');
    doc.querySelector('#entrance-archive').click();
    doc.querySelector('.destination-poster[data-project="7"]').click();
    check(!doc.querySelector('.project-opening h1 img'), 'Uploaded project text is displayed literally, without executing HTML');
    await until(() => doc.querySelector('.model-viewer')?.dataset.ready === 'true', 'real GLB render');
    const modelHost = doc.querySelector('.model-viewer'); modelHost.scrollIntoView(); await wait(80);
    check(modelHost.querySelector('canvas').width > 0, 'The uploaded GLB renders through the actual Three.js loader');
    const modelDistance = Number(modelHost.dataset.distance);
    modelHost.querySelector('[data-model-zoom="in"]').click();
    check(Number(modelHost.dataset.distance) < modelDistance, 'Model zoom controls change the actual camera');
    modelHost.querySelector('[data-model-reset]').click();
    check(Math.abs(Number(modelHost.dataset.distance) - modelDistance) < .01, 'Model reset restores its fitted camera');
    const play = modelHost.querySelector('[data-model-play]');
    check(!play.hidden && play.getAttribute('aria-pressed') === 'false', 'Model animations are available without autoplay');
    play.click(); check(play.getAttribute('aria-pressed') === 'true', 'Model animation can be played'); play.click();
    check(!doc.querySelector('.research,.fieldwork,.ending,.project .placeholder') && doc.querySelectorAll('[data-outcome]').length === 1, 'Unknown fields, research stages, media and empty outcomes stay hidden');
    modelHost.querySelector('canvas').dispatchEvent(new win.Event('webglcontextlost', {cancelable:true}));
    check(modelHost.dataset.ready === 'error' && !modelHost.querySelector('[data-model-retry]').hidden && doc.querySelector('.model-heading a'), 'A 3D failure exposes retry and download controls');
    modelHost.querySelector('[data-model-retry]').click();
    await until(() => modelHost.dataset.ready === 'true', 'model retry');
    doc.querySelector('[data-outcome="0"]').click();
    check(doc.querySelector('.document-download')?.getAttribute('href').endsWith('/uploads/test/report.docx'), 'Document outcomes have download links rather than broken images');
    doc.querySelector('.close').click();
    doc.querySelector('#home').click();
    await until(() => doc.querySelector('.globe')?.dataset.ready, 'new archive');
    doc.querySelector('#entrance-archive').click();
    check(doc.querySelectorAll('.destination-poster').length === 8 && doc.querySelectorAll('.globe-marker').length === 4, 'Projects with unknown coordinates appear in the archive without invented map positions');
    doc.querySelector('.gallery-close').click();
    (doc.querySelector('#entrance-new-project') || doc.querySelector('#new-project')).click(); await until(() => doc.querySelector('.agent-connection.ready'), 'second draft');
    check(!doc.querySelector('#agent-token') && doc.body.dataset.role === 'teacher', 'Teacher session persists without a shared administrator password');
    fill('[data-field="title"]', '有坐标的新项目'); fill('[data-field="origin"]', '上海'); fill('[data-field="destination"]', '西安');
    fill('#agent-origin-lat', '31.2304'); fill('#agent-origin-lng', '121.4737'); fill('#agent-lat', '34.3416'); fill('#agent-lng', '108.9398');
    doc.querySelector('.agent-publish').click(); await until(() => win.location.hash === '#explore' && doc.querySelector('.globe-marker[data-i="8"]'), 'second publication');
    check(submitted.project.originCoords.lat === 31.2304 && submitted.project.destinationCoords.lng === 108.9398, 'Departure and destination coordinates reach publication');
    check(doc.querySelectorAll('.globe-marker').length === 5, 'A newly published destination appears immediately on the main map');
    doc.querySelector('.globe-marker[data-i="8"]').click();
    await until(() => doc.querySelector('.journey-route-playback'), 'new journey route');
    await until(() => doc.querySelector('#destination-gallery').open, 'new journey gallery');
    doc.querySelector('.destination-poster[data-project="8"]').click();
    check(doc.querySelector('.project-opening h1').textContent === '有坐标的新项目', 'Map markers retain the correct project index when some journeys have no coordinates');
    check(!doc.querySelector('.model-viewer,.project .cover-placeholder'), 'Omitted model and cover do not create blank panels');
    doc.querySelector('header [data-language="en"]').click();
    check(doc.querySelector('.project-opening h1').textContent === '有坐标的新项目', 'Missing translations fall back to provided content instead of disappearing');
    frame.style.width = '390px'; (doc.querySelector('#entrance-new-project') || doc.querySelector('#new-project')).click(); await until(() => doc.querySelector('#project-agent').open, 'mobile assistant');
    check(doc.documentElement.scrollWidth <= win.innerWidth && doc.querySelector('#project-agent').scrollWidth <= doc.querySelector('#project-agent').clientWidth, '390px assistant and page have no horizontal overflow');
    doc.querySelector('.agent-close').click();
    output.textContent += '\nALL ASSISTANT CHECKS PASSED';
  } catch (error) { output.className = 'fail'; output.textContent += `\nFAIL ${error.message}`; }
  finally { if (originalFetch) frame.contentWindow.fetch = originalFetch; }
};
