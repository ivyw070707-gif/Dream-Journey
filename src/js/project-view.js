import {escapeHTML as esc} from './project-schema.js';
import {journeyRoute} from './route.js';

export const hasText = value => typeof value === 'string' && value.trim().length > 0;
export const projectStatus = (project, t) => t(project.createdAt ? 'published' : 'collected');
export const coverImage = (p, loading = 'lazy') => p.cover ? `<img class="cover-image" src="${esc(p.cover)}" alt="${esc(p.title)}" loading="${loading}">` : `<div class="cover-placeholder"><span>去远方 / DREAM JOURNEY</span><b>✳</b><strong>${esc(p.title)}</strong><small>${esc(p.destination)}</small></div>`;
export function contentSlot(label, value = '') {
  return hasText(value) ? `<div class="content-slot has-content"><small>${esc(label)}</small><p>${esc(value)}</p></div>` : '';
}
export function outcomeMarkup(outcome, label, t, link = false) {
  if (!outcome?.src) return '';
  if (!outcome.mime || outcome.mime.startsWith('image/')) return `<img class="outcome-image" src="${esc(outcome.src)}" alt="${esc(label)}" loading="lazy">`;
  const art = `<div class="document-artifact"><span aria-hidden="true">↗</span><strong>${esc(outcome.name || label)}</strong><small>${t('downloadArtifact')}</small></div>`;
  return link ? `<a class="document-download" href="${esc(outcome.src)}" target="_blank" rel="noopener">${art}</a>` : art;
}
function researchConstellation(notes, stages, t) {
  const populated = notes.map((note, index) => ({note, index})).filter(item => hasText(item.note));
  const positions = populated.map((_, i) => [populated.length === 1 ? 500 : 90 + i * 820 / (populated.length - 1), [150, 80, 220, 120, 250][i % 5]]);
  return `<svg viewBox="0 0 1000 340" class="constellation" aria-label="${t('constellation')}">${positions.slice(1).map(([x, y], i) => `<line x1="${positions[i][0]}" y1="${positions[i][1]}" x2="${x}" y2="${y}"/>`).join('')}${populated.map(({index}, i) => {
    const [x, y] = positions[i];
    return `<g class="star-node" tabindex="0" role="button" aria-label="${esc(stages[index])}" data-stage="${index}"><circle class="star-halo" cx="${x}" cy="${y}" r="19"/><path d="M${x - 7} ${y}h14M${x} ${y - 7}v14"/><circle cx="${x}" cy="${y}" r="3"/><text x="${x}" y="${y + 30}" text-anchor="middle">${esc(stages[index])}</text><text class="node-number" x="${x}" y="${y - 24}" text-anchor="middle">${String(index + 1).padStart(2, '0')}</text></g>`;
  }).join('')}</svg>`;
}
function modelMarkup(model, t, language) {
  const caption = model.caption?.[language] || model.caption?.zh || model.caption?.en || '';
  return `<div class="project-model"><div class="model-heading"><h3>${t('modelTitle')}</h3><a href="${esc(model.src)}" download="${esc(model.name || 'model.glb')}">${t('modelDownload')} ↗</a></div>
    <div class="model-viewer" role="group" aria-label="${t('modelTitle')}" data-model-src="${esc(model.src)}"><canvas tabindex="0" aria-label="${t('modelCanvas')}" aria-describedby="model-help model-keys"></canvas><p class="model-status" role="status">${t('modelLoading')}</p><button class="model-retry" data-model-retry hidden>${t('modelRetry')}</button>
    <div class="model-controls" hidden><button data-model-zoom="in" aria-label="${t('modelZoomIn')}">+</button><button data-model-zoom="out" aria-label="${t('modelZoomOut')}">−</button><button data-model-reset aria-label="${t('modelReset')}">⌂</button><button data-model-play aria-pressed="false" hidden>${t('modelPlay')}</button></div></div><p class="model-help" id="model-help">${t('modelHelp')}</p><span class="sr-only" id="model-keys">${t('modelKeys')}</span>${hasText(caption) ? `<p class="model-caption">${esc(caption)}</p>` : ''}</div>`;
}
export function renderProjectMarkup(p, {t, stages, index, language}) {
  let sectionIndex = 0;
  const heading = (eyebrow, title) => `<div class="section-heading"><span class="eyebrow">${String(++sectionIndex).padStart(2, '0')} / ${t(eyebrow)}</span><h2>${t(title)}</h2></div>`;
  const fact = (key, value) => value ? `<div><small>${t(key)}</small>${esc(value)}</div>` : '';
  const facts = [fact('explorers', p.studentName), fact(p.origin ? 'fromTo' : 'destination', p.origin ? `${p.origin} → ${p.destination}` : p.destination), fact('theme', p.theme), fact('year', p.year)].join('');
  const research = p.researchNotes.some(hasText) ? `<section class="research">${heading('thinkingEyebrow', 'thinkingTitle')}<div class="constellation-scroll">${researchConstellation(p.researchNotes, stages, t)}</div><div class="constellation-foot"><span>✳ &nbsp; ${t('everyPoint')}</span><span>${t('closer')} ↗</span></div></section>` : '';
  const photos = p.fieldPhotos.filter(photo => photo.src);
  const fieldImages = photos.length ? `<div class="field-photo-gallery">${photos.map(photo => `<figure><img src="${esc(photo.src)}" alt="${esc(photo.alt || '')}" loading="lazy">${hasText(photo.caption) ? `<figcaption>${esc(photo.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : '';
  const fieldNote = hasText(p.fieldNotes) ? `<div class="field-note">${contentSlot(t('fieldNotes'), p.fieldNotes)}<button class="text-link field-inspect">${t('readNote')} ↗</button></div>` : '';
  const fieldwork = p.origin || p.transport || fieldImages || fieldNote ? `<section class="fieldwork">${heading('fieldworkEyebrow', 'fieldworkTitle')}${journeyRoute(p, t)}${!p.origin ? contentSlot(t('agentTransport'), p.transport) : ''}${fieldImages || fieldNote ? `<div class="field-spread ${fieldImages && fieldNote ? '' : 'field-spread-single'}">${fieldImages}${fieldNote}</div>` : ''}</section>` : '';
  const outcomes = ['report', 'fieldPages', 'futureLetter'].map((key, i) => p.finalOutcomes[i]?.src ? `<button data-outcome="${i}" class="outcome ${['tall', 'notebook', 'small'][i]}">${outcomeMarkup(p.finalOutcomes[i], t(key), t)}<span>${t(key)} ↗</span></button>` : '').join('');
  const exhibition = outcomes || p.model?.src ? `<section class="outcomes">${heading('outcomesEyebrow', 'broughtBack')}${outcomes ? `<div class="exhibition">${outcomes}</div>` : ''}${p.model?.src ? modelMarkup(p.model, t, language) : ''}</section>` : '';
  const questions = p.unansweredQuestions.filter(hasText);
  const ending = questions.length ? `<section class="ending"><span class="tiny-star">✳</span><h2>${t('furtherQuestions')}</h2><div class="question-slots">${questions.map(question => `<p>↗ &nbsp; ${esc(question)}</p>`).join('')}</div><button class="continue">${t('continue')} <span>→</span></button></section>` : '';
  return `<article class="project"><div class="project-top"><button class="back">← ${t('back')}</button><span class="eyebrow">${t('journey')} ${String(index + 1).padStart(2, '0')} / ${esc(p.destination)}</span><span class="status-badge">${projectStatus(p, t)}</span></div>
    <section class="project-opening ${p.cover ? '' : 'project-opening-text'}"><div><span class="eyebrow">${t('journeyFile')}</span><h1>${esc(p.title)}</h1>${contentSlot(t('researchQuestion'), p.researchQuestion)}${facts ? `<div class="project-facts">${facts}</div>` : ''}${contentSlot(t('journeyNote'), p.note)}</div>
    ${p.cover ? `<button class="proposal inspect" aria-label="${t('inspect')}"><span class="tape"></span>${coverImage(p, 'eager')}<span class="inspect-label">${t('cover')} &nbsp; ⤢</span></button>` : ''}</section>${research}${fieldwork}${exhibition}${ending}</article>
    <footer><span>去远方 / Dream Journey</span><span>${t('disclaimer')}</span><button class="back">${t('return')} ↑</button></footer>`;
}
