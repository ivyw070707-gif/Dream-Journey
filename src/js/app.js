import {getProjects, getStages, getStageNotes} from './data.js';
import {initialLocale, translate} from './i18n.js';
import {journeyRoute} from './route.js';
import {landscape} from './landscape.js';

const app = document.querySelector('#app'), dialog = document.querySelector('#viewer');
let storage;
try { storage = window.localStorage; } catch { /* Storage is optional. */ }
let language = initialLocale(storage, navigator.language);
let projects = getProjects(language), stages = getStages(language);
let active = 0, selected = null, globe = null, globeView, cleanup = () => {}, renderId = 0;
let currentNav = 'explore', viewerState = null;
const t = key => translate(key, language);
const number = i => String(i + 1).padStart(2, '0');
const total = () => String(projects.length).padStart(2, '0');
const coverImage = (p, loading = 'lazy') => `<img class="cover-image" src="${p.cover}" alt="${p.title}" loading="${loading}">`;
function contentSlot(label, value = '') {
  return `<div class="content-slot ${value ? 'has-content' : ''}"><small>${label}</small><p>${value || `<span class="placeholder">${t('pending')}</span>`}</p></div>`;
}
function mediaSlot(label) {
  return `<div class="media-slot"><svg viewBox="0 0 80 65" aria-hidden="true"><path d="M7 10L73 7 76 56 5 59ZM10 51L30 29 43 43 54 30 70 49"/><circle cx="56" cy="21" r="5"/></svg><span>${label}</span></div>`;
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollBehavior = () => reducedMotion() ? 'instant' : 'smooth';

function setNavigation(section) {
  currentNav = section;
  for (const id of ['explore', 'journeys', 'impact']) {
    const button = document.getElementById(id), isActive = id === (viewerState?.type === 'idea' ? 'impact' : section);
    button.classList.toggle('nav-active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
}

function updateHeader() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = t('pageTitle');
  document.querySelector('meta[name="description"]').content = t('description');
  document.querySelector('#explore').textContent = `${t('explore')} ↗`;
  document.querySelector('#journeys').textContent = t('journeys');
  document.querySelector('#impact').textContent = `${t('idea')} ↗`;
  document.querySelector('.header-note').textContent = t('motto');
  document.querySelector('.close').setAttribute('aria-label', t('close'));
  document.querySelector('nav').setAttribute('aria-label', language === 'zh' ? '主导航' : 'Main navigation');
  document.querySelectorAll('.language-switch').forEach(group => group.setAttribute('aria-label', language === 'zh' ? '网站语言' : 'Site language'));
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  setNavigation(currentNav);
}

function beginRender() {
  renderId++;
  if (globe) { globeView = globe.getView(); globe.dispose(); globe = null; }
  cleanup(); cleanup = () => {};
}

function globeMarkup() {
  return `<div class="globe" role="group" aria-label="${t('globeLabel')}">
    <canvas tabindex="0" aria-label="${t('globeLabel')}" aria-describedby="globe-help globe-keys"></canvas>
    <div class="globe-markers">${projects.map((p, i) => `<button class="globe-marker ${i === active ? 'active' : ''}" data-i="${i}" aria-pressed="${i === active}" aria-label="${t('followJourney')}: ${p.destination}"><span class="marker-dot"></span><span class="marker-label">${p.destination}</span></button>`).join('')}</div>
    <span class="globe-status" role="status">${t('loading')}</span>
    <div class="globe-controls"><button data-globe="in" aria-label="${t('zoomIn')}">+</button><button data-globe="out" aria-label="${t('zoomOut')}">−</button><button data-globe="reset" aria-label="${t('reset')}">⌂</button></div>
    <span class="globe-help" id="globe-help">${t('globeHelp')}</span><span class="sr-only" id="globe-keys">${t('globeKeys')}</span>
  </div>`;
}

function renderMap() {
  beginRender(); selected = null;
  app.innerHTML = `<section class="atlas"><div class="atlas-heading"><div class="eyebrow"><span class="tiny-star">✳</span> ${t('atlas')}</div><h1>去远方<span class="title-dot">。</span></h1><p>${t('hero')}</p><div class="small-rule"></div><span class="intro-cn">${t('intro')}</span></div>
    <div class="map-wrap">${globeMarkup()}<span class="map-caption">${t('mapCaption')}</span></div>
    <div class="map-side"><span>01 — ${total()}</span><div class="vertical-text">${t('followQuestion')}</div></div>
    <div class="question-panel"><span class="eyebrow">${t('firstQuestion')}</span><h2 id="question"></h2><p id="question-meta"></p><button id="enter" class="text-link">${t('followJourney')} <span>↗</span></button></div>
    <div class="atlas-bottom"><span><i class="red-dot"></i> <b>${total()}</b> ${t('possibilities')}</span><span class="atlas-hint">${t('choosePoint')}</span></div></section>
    <section class="archive" id="archive"><div class="archive-top"><span class="eyebrow">${t('beginning')}</span><span class="drag-note">← &nbsp; ${t('drag')} &nbsp; →</span><div><button id="prev" aria-label="${t('previous')}">←</button><button id="next" aria-label="${t('next')}">→</button></div></div>
    <div class="gallery" aria-label="${t('archive')}">${projects.map((p, i) => `<button class="artifact ${i === active ? 'chosen' : ''}" data-i="${i}" aria-label="${p.title}" style="--rot:${[-5,3,-2,4][i]}deg"><span class="tape"></span>${coverImage(p, i === active ? 'eager' : 'lazy')}<span class="artifact-label"><span>${number(i)} / ${p.destination}</span><span>${p.title} ↗</span></span></button>`).join('')}</div>
    <div class="archive-footer"><span>${t('realBeginnings')}</span><span id="counter"></span><span>${t('paperBeginning')}</span></div></section>
    <section class="atlas-coda"><div class="coda-art">${landscape({kind: 'river'})}</div><div><span class="eyebrow">${t('codaEyebrow')}</span><h2>${t('codaTitle')}</h2><p>${t('codaBody')}</p><button class="text-link idea-open">${t('about')} ↗</button></div></section>
    <footer><span>去远方 / Dream Journey</span><span>${t('disclaimer')}</span><button id="about-footer">${t('about')} ↗</button></footer>`;
  setNavigation(currentNav === 'journeys' ? 'journeys' : 'explore');
  bindMap(); updateSelection(false);
  centerGallery(false);
  const thisRender = renderId, host = document.querySelector('.globe');
  const fallback = () => {
    if (thisRender !== renderId) return;
    if (globe) { globeView = globe.getView(); globe.dispose(); globe = null; }
    host.classList.add('globe-fallback'); host.dataset.ready = 'fallback';
    host.querySelector('.globe-status').textContent = t('mapFallback');
    host.querySelector('.globe-status').hidden = false;
    host.querySelectorAll('.globe-marker').forEach((button, i) => {
      button.hidden = false; button.style.left = ''; button.style.top = '';
      button.onclick = () => { active = i; updateSelection(); };
    });
  };
  import('./globe.js').then(({createGlobe}) => {
    if (thisRender !== renderId) return;
    try { globe = createGlobe(host, {projects, active, view: globeView, onSelect: i => { active = i; updateSelection(); }, onError: fallback}); }
    catch { fallback(); }
  }).catch(fallback);
}

function centerGallery(smooth = true) {
  const gallery = document.querySelector('.gallery'), element = gallery.children[active];
  gallery.scrollTo({left: element.offsetLeft - gallery.offsetLeft - gallery.clientWidth / 2 + element.clientWidth / 2, behavior: smooth ? scrollBehavior() : 'instant'});
}
function updateSelection(scroll = true) {
  const p = projects[active];
  document.querySelector('#question').textContent = p.researchQuestion || p.title;
  document.querySelector('#question-meta').textContent = `${p.destination} · ${t('detailsPending')}`;
  document.querySelector('#counter').textContent = `${number(active)} / ${total()}`;
  document.querySelectorAll('.artifact').forEach((element, i) => element.classList.toggle('chosen', i === active));
  document.querySelectorAll('.globe-marker').forEach((element, i) => {
    element.classList.toggle('active', i === active); element.setAttribute('aria-pressed', String(i === active));
  });
  globe?.select(active);
  if (scroll) centerGallery();
}

function bindMap() {
  const events = new AbortController(), signal = events.signal;
  document.querySelector('#enter').onclick = () => openProject(active);
  document.querySelector('#prev').onclick = () => { active = (active + projects.length - 1) % projects.length; updateSelection(); };
  document.querySelector('#next').onclick = () => { active = (active + 1) % projects.length; updateSelection(); };
  const gallery = document.querySelector('.gallery');
  let down = false, start = 0, left = 0, moved = false, timer;
  gallery.addEventListener('pointerdown', event => { down = true; moved = false; start = event.clientX; left = gallery.scrollLeft; }, {signal});
  window.addEventListener('pointerup', () => { down = false; }, {signal});
  window.addEventListener('pointercancel', () => { down = false; }, {signal});
  gallery.addEventListener('pointermove', event => {
    if (!down || event.pointerType === 'touch') return;
    if (Math.abs(event.clientX - start) > 5) { moved = true; gallery.scrollLeft = left - (event.clientX - start); }
  }, {signal});
  gallery.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const center = gallery.scrollLeft + gallery.clientWidth / 2;
      const closest = [...gallery.children].map((element, i) => ({i, distance: Math.abs(element.offsetLeft - gallery.offsetLeft + element.clientWidth / 2 - center)})).sort((a, b) => a.distance - b.distance)[0].i;
      if (closest !== active) { active = closest; updateSelection(false); }
    }, 120);
  }, {signal});
  gallery.querySelectorAll('.artifact').forEach(element => element.onclick = () => {
    if (moved) return;
    const index = Number(element.dataset.i);
    if (index === active) openProject(index); else { active = index; updateSelection(); }
  });
  document.querySelector('#about-footer').onclick = showIdea;
  document.querySelector('.idea-open').onclick = showIdea;
  const observer = new IntersectionObserver(([entry]) => {
    if (!selected) setNavigation(entry.isIntersecting && entry.boundingClientRect.top < innerHeight * 0.65 ? 'journeys' : 'explore');
  }, {rootMargin: '0px 0px -35% 0px'});
  observer.observe(document.querySelector('#archive'));
  cleanup = () => { events.abort(); observer.disconnect(); clearTimeout(timer); };
}

const positions = [[65,210],[165,140],[235,55],[288,191],[340,300],[410,112],[477,222],[550,74],[617,171],[687,277],[760,130],[830,224],[924,110]];
const edges = [[0,1],[1,2],[1,3],[2,4],[4,5],[3,5],[5,6],[6,7],[7,8],[8,9],[8,10],[9,11],[10,11],[11,12]];
function researchConstellation() {
  return `<svg viewBox="0 0 1000 370" class="constellation" aria-label="${t('constellation')}">${edges.map(([a,b]) => `<line x1="${positions[a][0]}" y1="${positions[a][1]}" x2="${positions[b][0]}" y2="${positions[b][1]}"/>`).join('')}${positions.map(([x,y],i) => `<g class="star-node" tabindex="0" role="button" aria-label="${stages[i]}" data-stage="${i}"><circle class="star-halo" cx="${x}" cy="${y}" r="19"/><path d="M${x-7} ${y}h14M${x} ${y-7}v14"/><circle cx="${x}" cy="${y}" r="3"/><text x="${x}" y="${y+30}" text-anchor="middle">${stages[i]}</text><text class="node-number" x="${x}" y="${y-24}" text-anchor="middle">${number(i)}</text></g>`).join('')}</svg>`;
}

function openProject(i) {
  active = i; selected = projects[i];
  history.pushState({}, '', `#journey/${selected.id}`); renderProject(); window.scrollTo(0, 0);
}
function renderProject() {
  beginRender(); setNavigation('journeys');
  const p = selected;
  const photo = p.fieldPhotos[0];
  const fieldImage = photo ? `<figure><img src="${photo.src}" alt="${photo.alt || ''}" loading="lazy"><figcaption>${photo.caption || ''}</figcaption></figure>` : mediaSlot(t('fieldPhotoPending'));
  const outcomeKeys = ['report', 'fieldPages', 'futureLetter'];
  app.innerHTML = `<article class="project"><div class="project-top"><button class="back">← ${t('back')}</button><span class="eyebrow">${t('journey')} ${number(active)} / ${p.destination}</span><span class="status-badge">${t('detailsPending')}</span></div>
    <section class="project-opening"><div><span class="eyebrow">${t('journeyFile')}</span><h1>${p.title}</h1>
      ${contentSlot(t('researchQuestion'), p.researchQuestion)}
      <div class="project-facts"><div><small>${t('explorers')}</small>${p.studentName || '<span class="placeholder">—</span>'}</div><div><small>${t('fromTo')}</small><span class="${p.origin ? '' : 'placeholder'}">${p.origin || t('departurePending')}</span> → ${p.destination}</div><div><small>${t('theme')}</small>${p.theme || '<span class="placeholder">—</span>'}</div><div><small>${t('year')}</small>${p.year || '<span class="placeholder">—</span>'}</div></div>
      ${contentSlot(t('journeyNote'), p.note)}</div>
      <button class="proposal inspect" aria-label="${t('inspect')}"><span class="tape"></span>${coverImage(p, 'eager')}<span class="inspect-label">${t('cover')} &nbsp; ⤢</span></button></section>
    <section class="research"><div class="section-heading"><span class="eyebrow">${t('thinking')}</span><h2>${t('thinkingTitle')}</h2><p>${t('thinkingBody')}</p></div><div class="constellation-scroll">${researchConstellation()}</div><div class="constellation-foot"><span>✳ &nbsp; ${t('everyPoint')}</span><span>${t('closer')} ↗</span></div></section>
    <section class="fieldwork"><div class="section-heading"><span class="eyebrow">${t('fieldwork')}</span><h2>${t('fieldworkTitle')}</h2><p>${t('fieldworkBody')}</p></div>${journeyRoute(p, t)}<div class="field-spread">${fieldImage}<div class="field-note"><span class="eyebrow">${t('fieldNotes')}</span>${contentSlot(t('fieldNotes'), p.fieldNotes)}<button class="text-link field-inspect">${t('readNote')} ↗</button></div></div></section>
    <section class="outcomes"><div class="section-heading"><span class="eyebrow">${t('exhibition')}</span><h2>${t('broughtBack')}</h2><p>${t('exhibitionBody')}</p></div><div class="exhibition">${outcomeKeys.map((key, i) => `<button data-outcome="${i}" class="outcome ${['tall','notebook','small'][i]}">${p.finalOutcomes[i]?.src ? `<img class="outcome-image" src="${p.finalOutcomes[i].src}" alt="${t(key)}" loading="lazy">` : mediaSlot(t('outcomePending'))}<span>${number(i)} / ${t(key)} ↗</span></button>`).join('')}</div></section>
    <section class="ending"><span class="tiny-star">✳</span><h2>${t('furtherQuestions')}</h2><div class="question-slots">${(p.unansweredQuestions.length ? p.unansweredQuestions : ['', '', '']).map(q => `<p class="${q ? '' : 'placeholder'}">↗ &nbsp; ${q || t('questionPending')}</p>`).join('')}</div><button class="continue">${t('continue')} <span>→</span></button></section></article>
    <footer><span>去远方 / Dream Journey</span><span>${t('disclaimer')}</span><button class="back">${t('return')} ↑</button></footer>`;
  document.querySelectorAll('.back,.continue').forEach(element => element.onclick = () => goHome());
  document.querySelector('.inspect').onclick = () => openViewer({type: 'cover'});
  document.querySelectorAll('.star-node').forEach(element => {
    const show = () => openViewer({type: 'stage', index: Number(element.dataset.stage)});
    element.onclick = show;
    element.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); show(); } };
  });
  document.querySelector('.field-inspect').onclick = () => openViewer({type: 'fieldNotes'});
  document.querySelectorAll('[data-outcome]').forEach(element => element.onclick = () => openViewer({type: 'outcome', index: Number(element.dataset.outcome)}));
}

function openViewer(state) {
  viewerState = state; renderViewer();
  if (!dialog.open) dialog.showModal();
  setNavigation(currentNav);
}
function renderViewer() {
  const state = viewerState, p = selected;
  let title, html, description, status = t('pending');
  if (state.type === 'idea') {
    title = t('ideaTitle'); html = `<div class="idea-art">${landscape({kind: 'house'})}<div class="eyebrow">${t('motto')}</div></div>`; description = t('ideaBody'); status = '';
  } else if (state.type === 'cover') {
    title = p.title; html = coverImage(p, 'eager'); description = `${t('cover')} · ${p.destination}`; status = t('cover');
  } else if (state.type === 'stage') {
    title = stages[state.index];
    const note = getStageNotes(language, p)[state.index];
    html = `<div class="context-note"><small>${t('researchNote')} / ${number(state.index)}</small><span class="tiny-star">✳</span><h3 class="${note ? '' : 'placeholder'}">${note || t('pending')}</h3></div>`;
    description = note ? '' : t('pendingBody');
  } else if (state.type === 'fieldNotes') {
    title = t('fieldNotes'); html = contentSlot(title, p.fieldNotes); description = p.fieldNotes ? '' : t('pendingBody');
  } else {
    title = t(['report','fieldPages','futureLetter'][state.index]);
    const outcome = p.finalOutcomes[state.index];
    html = outcome?.src ? `<img class="outcome-image" src="${outcome.src}" alt="${title}">` : mediaSlot(t('outcomePending'));
    description = outcome?.caption?.[language] || t('pendingBody');
  }
  document.querySelector('#viewer-content').innerHTML = `<div class="viewer-art">${html}</div><aside><span class="eyebrow">${t('archiveTitle')}</span><h2 id="viewer-title">${title}</h2><p>${description}</p><small>${status}</small></aside>`;
}

function showIdea() { openViewer({type: 'idea'}); }
function goHome(section = 'explore') {
  if (dialog.open) dialog.close();
  viewerState = null; currentNav = section;
  history.pushState({}, '', `#${section}`); renderMap();
  if (section === 'journeys') document.querySelector('#archive').scrollIntoView({behavior: scrollBehavior()});
  else window.scrollTo(0, 0);
}
function switchLanguage(nextLanguage) {
  if (nextLanguage === language) return;
  const scrollY = window.scrollY;
  language = nextLanguage;
  try { storage?.setItem('dream-journey-language', language); } catch { /* Keep working without persistence. */ }
  projects = getProjects(language); stages = getStages(language);
  updateHeader();
  if (selected) { selected = projects[active]; renderProject(); } else renderMap();
  if (viewerState) renderViewer();
  setNavigation(currentNav);
  window.scrollTo({top: scrollY, behavior: 'instant'});
}

document.querySelector('.close').onclick = () => dialog.close();
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => { viewerState = null; setNavigation(currentNav); });
document.querySelector('#home').onclick = () => goHome();
document.querySelector('#explore').onclick = () => goHome();
document.querySelector('#journeys').onclick = () => goHome('journeys');
document.querySelector('#impact').onclick = showIdea;
document.querySelectorAll('[data-language]').forEach(button => button.onclick = () => switchLanguage(button.dataset.language));
function init() {
  if (dialog.open) dialog.close(); viewerState = null;
  const id = location.hash.startsWith('#journey/') ? location.hash.slice(9) : '';
  const index = projects.findIndex(p => p.id === id);
  if (index >= 0) { active = index; selected = projects[index]; renderProject(); window.scrollTo(0, 0); }
  else {
    currentNav = location.hash === '#journeys' ? 'journeys' : 'explore'; renderMap();
    if (location.hash === '#journeys') document.querySelector('#archive').scrollIntoView();
  }
}
window.addEventListener('popstate', init);
window.addEventListener('hashchange', () => {
  const expected = selected ? `#journey/${selected.id}` : `#${currentNav}`;
  if (location.hash !== expected) init();
});
updateHeader(); init();
