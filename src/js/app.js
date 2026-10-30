import {getProjects, getStages, getStageNotes} from './data.js';
import {initialLocale, translate} from './i18n.js';
import {landscape} from './landscape.js';
import {escapeHTML as esc} from './project-schema.js';
import {loadPublishedProjects} from './project-api.js';
import {createProjectAgent} from './project-agent.js';
import {createAccount} from './account.js';
import {coverImage, contentSlot, outcomeMarkup, renderProjectMarkup} from './project-view.js';
import {playJourneyRoutes} from './route.js';

const app = document.querySelector('#app'), dialog = document.querySelector('#viewer');
const destinationGallery = document.querySelector('#destination-gallery');
let galleryDestination = null, galleryReturnFocus = null;
let storage;
try { storage = window.localStorage; } catch { /* Storage is optional. */ }
let language = initialLocale(storage, navigator.language);
let publishedProjects = [], projects = getProjects(language), stages = getStages(language);
let active = 0, selected = null, globe = null, globeView, cleanup = () => {}, renderId = 0;
let currentNav = 'explore', viewerState = null, routePlayback = null;
let sponsorStars = null, sponsorHost = null, sponsorLayer = null, sponsorLoad = 0, sponsoredProjectIds = [];
const t = key => translate(key, language);
const number = i => String(i + 1).padStart(2, '0');

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
  document.querySelector('#new-project').textContent = t('agentOpen');
  document.querySelector('#project-service-status').textContent = t('sharedLoadError');
  document.querySelector('.header-note').textContent = t('motto');
  document.querySelector('.close').setAttribute('aria-label', t('close'));
  document.querySelector('nav').setAttribute('aria-label', language === 'zh' ? '主导航' : 'Main navigation');
  document.querySelectorAll('.language-switch').forEach(group => group.setAttribute('aria-label', language === 'zh' ? '网站语言' : 'Site language'));
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
  refreshAccountControls();
  setNavigation(currentNav);
}

function refreshAccountControls() {
  const user = account.getUser();
  document.body.dataset.role = user?.role || 'visitor';
  document.querySelectorAll('[data-account]').forEach(button => { button.textContent = user ? `${t(`role_${user.role}`)} · ${user.name}` : t('visitorLogin'); button.onclick = () => account.open(); });
  document.querySelectorAll('[data-teacher-only]').forEach(button => { button.hidden = user?.role !== 'teacher'; });
}
function openProjectAssistant() {
  if (account.getUser()?.role === 'teacher') projectAgent.open();
  else account.open({purpose: 'upload', afterLogin: () => projectAgent.open()});
}

function cancelRoutePlayback() { routePlayback?.cancel(); routePlayback = null; }
function destroySponsorStars() {
  sponsorLoad++; sponsorStars?.destroy(); sponsorStars = null; sponsorHost = null;
  sponsorLayer?.remove(); sponsorLayer = null;
}
async function mountSponsorStars(host) {
  if (account.getUser()?.role !== 'donor' || !host) { destroySponsorStars(); return; }
  if (sponsorStars && sponsorHost === host) return;
  destroySponsorStars(); const load = sponsorLoad;
  await import('../../sponsor-stars-plugin/sponsor-stars.js');
  if (load !== sponsorLoad || account.getUser()?.role !== 'donor' || !host.isConnected) return;
  sponsorLayer = document.createElement('div'); sponsorLayer.className = 'sponsor-star-layer'; host.append(sponsorLayer);
  sponsorHost = host;
  sponsorStars = new window.SponsorStars({
    mount: document.body, mapLayer: sponsorLayer, fundedProjectIds: sponsoredProjectIds,
    bagImage: new URL('../../sponsor-stars-plugin/assets/star-bag.png', import.meta.url).href,
    projects: mapEntries().map(({project, i}) => ({id: project.id, index: i, city: project.destination, focus: project.title, lat: project.destinationCoords.lat, lng: project.destinationCoords.lng})),
    getProjectPoint: project => mapPoint(host, project),
    onSelect: project => openDestination(project.index),
    onFund: result => { sponsoredProjectIds = result.fundedProjectIds; }
  });
  sponsorStars.togglePanel(window.matchMedia('(min-width: 901px)').matches);
}
function beginRender() {
  renderId++; cancelRoutePlayback(); destroySponsorStars();
  if (globe) { globeView = globe.getView(); globe.dispose(); globe = null; }
  cleanup(); cleanup = () => {};
}

function sameDestination(a, b) {
  return a.destination === b.destination || (a.destinationCoords && b.destinationCoords &&
    Math.abs(a.destinationCoords.lat - b.destinationCoords.lat) < 0.001 && Math.abs(a.destinationCoords.lng - b.destinationCoords.lng) < 0.001);
}
function destinationEntries(index) {
  const destination = projects[index];
  return projects.map((project, i) => ({project, i})).filter(({project}) => sameDestination(project, destination));
}
function mapEntries() {
  return projects.map((project, i) => ({project, i})).filter(({project, i}) => project.destinationCoords && projects.findIndex(candidate => sameDestination(candidate, project)) === i);
}
function mapPoint(host, point) {
  if (globe) return globe.project(point);
  const scale = Math.min(host.clientWidth / 750, host.clientHeight / 500);
  return {x: (host.clientWidth - 750 * scale) / 2 + (point.lng - 65) * 10 * scale, y: (host.clientHeight - 500 * scale) / 2 + (60 - point.lat) * 10 * scale};
}
function globeMarkup() {
  return `<div class="globe" role="group" aria-label="${t('globeLabel')}">
    <canvas tabindex="0" aria-label="${t('globeLabel')}" aria-describedby="globe-help globe-keys"></canvas>
    <div class="globe-markers">${mapEntries().map(({project: p, i}) => `<button class="globe-marker ${sameDestination(p, projects[active]) ? 'active' : ''}" data-i="${i}" aria-pressed="${sameDestination(p, projects[active])}" aria-label="${t('followJourney')}: ${esc(p.destination)}"><span class="marker-dot"></span><span class="marker-label">${esc(p.destination)}</span></button>`).join('')}</div>
    <span class="globe-status" role="status">${t('loading')}</span>
    <div class="globe-controls"><button data-globe="in" aria-label="${t('zoomIn')}">+</button><button data-globe="out" aria-label="${t('zoomOut')}">−</button><button data-globe="reset" aria-label="${t('reset')}">⌂</button></div>
    <span class="globe-help" id="globe-help">${t('globeHelp')}</span><span class="sr-only" id="globe-keys">${t('globeKeys')}</span>
  </div>`;
}

function renderMap() {
  beginRender(); selected = null;
  document.body.classList.add('atlas-only');
  app.innerHTML = `<section class="atlas atlas-entrance"><div class="entrance-brand" lang="en"><h1 class="entrance-title">ToFar</h1><p class="entrance-tagline">Not too far, to far</p></div><div class="map-wrap">${globeMarkup()}</div><div class="entrance-actions"><button id="entrance-archive">${t('journeys')}</button><button data-account class="account-button"></button><button id="entrance-new-project" data-teacher-only hidden>${t('agentOpen')}</button></div></section>`;
  setNavigation('explore');
  document.querySelector('#entrance-new-project').onclick = openProjectAssistant;
  refreshAccountControls();
  document.querySelector('#entrance-archive').onclick = () => openArchive();
  const thisRender = renderId, host = document.querySelector('.globe');
  let flatObserver;
  const fallback = () => {
    if (thisRender !== renderId) return;
    if (globe) { globeView = globe.getView(); globe.dispose(); globe = null; }
    host.classList.add('globe-fallback'); host.dataset.ready = 'fallback';
    host.querySelector('.globe-status').hidden = true;
    const positionMarkers = () => {
      host.querySelectorAll('.globe-marker').forEach(button => {
        const i = Number(button.dataset.i), point = mapPoint(host, projects[i].destinationCoords);
        button.hidden = false;
        button.style.left = `${point.x}px`;
        button.style.top = `${point.y}px`;
        button.style.setProperty('--label-x','12px'); button.style.setProperty('--label-y','0px');
        button.onclick = () => openDestination(i);
      });
    };
    positionMarkers(); flatObserver?.disconnect(); flatObserver = new ResizeObserver(positionMarkers); flatObserver.observe(host);
  };
  // Bind immediately, including while WebGL and geography load.
  host.querySelectorAll('.globe-marker').forEach(button => button.onclick = () => openDestination(Number(button.dataset.i)));
  cleanup = () => flatObserver?.disconnect();
  import('./globe.js').then(({createGlobe}) => {
    if (thisRender !== renderId) return;
    try { globe = createGlobe(host, {projects, active, view: globeView, onError: fallback}); }
    catch { fallback(); }
  }).catch(fallback);
  mountSponsorStars(host);

}

function updateSelection() {
  document.querySelectorAll('.globe-marker').forEach(element => {
    const i = Number(element.dataset.i), isActive = sameDestination(projects[i], projects[active]);
    element.classList.toggle('active', isActive); element.setAttribute('aria-pressed', String(isActive));
  });
  globe?.select(active);
}
function openArchive({push = true} = {}) {
  galleryDestination = '*'; renderDestinationGallery(); document.body.classList.add('gallery-open');
  if (!destinationGallery.open) destinationGallery.showModal();
  if (push) history.pushState({}, '', '#journeys');
}
function centeredEntries(entries) {
  const featured = entries.findIndex(({project}) => project.featured);
  if (featured < 0) return entries;
  const ordered = [...entries], [entry] = ordered.splice(featured, 1);
  ordered.splice(Math.floor(ordered.length / 2), 0, entry);
  return ordered;
}
function centerFeaturedPoster() {
  requestAnimationFrame(() => {
    if (!destinationGallery.open) return;
    const container = destinationGallery.querySelector('.destination-posters'), featured = destinationGallery.querySelector('.destination-poster.featured');
    if (!container || !featured) return;
    const containerRect = container.getBoundingClientRect(), featuredRect = featured.getBoundingClientRect();
    container.scrollLeft += featuredRect.left - containerRect.left - (container.clientWidth - featuredRect.width) / 2;
  });
}
function openDestination(index, {push = true, animate = true} = {}) {
  cancelRoutePlayback(); active = index; updateSelection(); galleryDestination = projects[index].id;
  galleryReturnFocus = document.querySelector(`.globe-marker[data-i="${index}"]`);
  const destinationId = galleryDestination, thisRender = renderId;
  const openGallery = () => {
    renderDestinationGallery(); document.body.classList.add('gallery-open');
    if (!destinationGallery.open) destinationGallery.showModal();
    if (push) history.pushState({}, '', `#gallery/${destinationId}`);
  };
  if (!animate) { openGallery(); return; }
  const host = document.querySelector('.globe');
  const playback = playJourneyRoutes(host, destinationEntries(index), {
    project: point => mapPoint(host, point)
  });
  routePlayback = playback;
  playback.finished.then(completed => {
    if (routePlayback === playback) routePlayback = null;
    if (completed && thisRender === renderId && galleryDestination === destinationId) openGallery();
  });
}
function renderDestinationGallery() {
  const all = galleryDestination === '*';
  const entries = centeredEntries(all ? projects.map((project, i) => ({project, i})) : destinationEntries(active));
  const place = projects[active], english = getProjects('en', publishedProjects)[active];
  destinationGallery.innerHTML = `<button class="gallery-close" aria-label="${t('backMap')}"><span>${t('backMap')}</span><i aria-hidden="true">×</i></button>
    <div class="destination-gallery-layout"><div class="gallery-editorial"><span class="gallery-folio">${all ? String(entries.length).padStart(2, '0') : number(active)} / ${t('destinationArchive')}</span><h2 id="destination-gallery-title">${all ? t('journeys') : esc(place.destination)}</h2>${all ? '' : `<span class="gallery-city-en">${esc(english.destination)}</span><div class="gallery-editorial-rule"></div><h3>${esc(place.title)}</h3><button class="gallery-project-link">${t('followJourney')} <span>↗</span></button>`}<p class="gallery-instruction">${t('posterInstruction')}</p></div>
    <div class="destination-posters ${entries.length === 1 ? 'single-poster' : ''}" aria-label="${t('archive')}">${entries.map(({project, i}, n) => `<button class="destination-poster ${project.featured ? 'featured' : ''}" data-project="${i}" aria-label="${t('followJourney')}: ${esc(project.title)}"><span class="poster-mount">${coverImage(project, 'eager')}</span><span class="poster-caption"><span>${String(n + 1).padStart(2, '0')} / ${String(entries.length).padStart(2, '0')}</span><span>${esc(project.title)}</span><span>↗</span></span></button>`).join('')}</div></div>`;
  destinationGallery.querySelector('.gallery-close').onclick = () => closeDestinationGallery();
  const projectLink = destinationGallery.querySelector('.gallery-project-link');
  if (projectLink) projectLink.onclick = () => openProject(active);
  destinationGallery.querySelectorAll('[data-project]').forEach(button => button.onclick = () => openProject(Number(button.dataset.project)));
  centerFeaturedPoster();
}
function closeDestinationGallery({navigate = true} = {}) {
  galleryDestination = null; document.body.classList.remove('gallery-open');
  if (destinationGallery.open) destinationGallery.close();
  if (navigate && (location.hash.startsWith('#gallery/') || location.hash === '#journeys')) {
    // Replace this layer with the map without manufacturing another history entry.
    history.replaceState({}, '', '#explore');
  }
  galleryReturnFocus?.focus({preventScroll:true});
}
destinationGallery.addEventListener('cancel', event => { event.preventDefault(); closeDestinationGallery(); });
destinationGallery.addEventListener('click', event => { if (event.target === destinationGallery || event.target.classList.contains('destination-gallery-layout') || event.target.classList.contains('destination-posters')) closeDestinationGallery(); });

function openProject(i) {
  closeDestinationGallery({navigate:false});
  active = i; selected = projects[i];
  history.pushState({}, '', `#journey/${selected.id}`); renderProject(); window.scrollTo(0, 0);
}
function renderProject() {
  beginRender(); document.body.classList.remove('atlas-only'); setNavigation('journeys');
  const p = selected;
  app.innerHTML = renderProjectMarkup(p, {t, stages, index: active, language});
  document.querySelectorAll('.back,.continue').forEach(element => element.onclick = () => goHome());
  const inspect = document.querySelector('.inspect');
  if (inspect) inspect.onclick = () => openViewer({type: 'cover'});
  document.querySelectorAll('.star-node').forEach(element => {
    const show = () => openViewer({type: 'stage', index: Number(element.dataset.stage)});
    element.onclick = show;
    element.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); show(); } };
  });
  const fieldInspect = document.querySelector('.field-inspect');
  if (fieldInspect) fieldInspect.onclick = () => openViewer({type: 'fieldNotes'});
  document.querySelectorAll('[data-outcome]').forEach(element => element.onclick = () => openViewer({type: 'outcome', index: Number(element.dataset.outcome)}));
  const modelHost = document.querySelector('.model-viewer');
  if (modelHost) {
    const thisRender = renderId;
    let modelViewer;
    const mount = async () => {
      try {
        const {createModelViewer, showModelFailure} = await import('./model-viewer.js');
        if (thisRender !== renderId) return;
        modelViewer?.dispose();
        try { modelViewer = createModelViewer(modelHost, {src: p.model.src, t}); }
        catch { showModelFailure(modelHost, t); }
      } catch {
        if (thisRender === renderId) {
          modelHost.dataset.ready = 'error';
          modelHost.querySelector('.model-status').textContent = t('modelFailed');
          modelHost.querySelector('[data-model-retry]').hidden = false;
        }
      }
    };
    modelHost.querySelector('[data-model-retry]').onclick = mount;
    cleanup = () => { modelViewer?.dispose(); };
    mount();
  }
}

function openViewer(state) {
  viewerState = state; renderViewer();
  if (!dialog.open) dialog.showModal();
  setNavigation(currentNav);
}
function renderViewer() {
  const state = viewerState, p = selected;
  let title, html, description, status = '';
  if (state.type === 'idea') {
    title = t('ideaTitle'); html = `<div class="idea-art">${landscape({kind: 'house'})}<div class="eyebrow">${t('motto')}</div></div>`; description = t('ideaBody'); status = '';
  } else if (state.type === 'cover') {
    title = p.title; html = coverImage(p, 'eager'); description = `${t('cover')} · ${p.destination}`; status = t('cover');
  } else if (state.type === 'stage') {
    title = stages[state.index];
    const note = getStageNotes(language, p)[state.index];
    html = `<div class="context-note"><small>${t('researchNote')} / ${number(state.index)}</small><span class="tiny-star">✳</span><h3>${esc(note)}</h3></div>`;
    description = '';
  } else if (state.type === 'fieldNotes') {
    title = t('fieldNotes'); html = contentSlot(title, p.fieldNotes); description = '';
  } else {
    title = t(['report','fieldPages','futureLetter'][state.index]);
    const outcome = p.finalOutcomes[state.index];
    html = outcomeMarkup(outcome, title, t, true);
    description = outcome?.caption?.[language] || outcome?.caption?.zh || outcome?.caption?.en || '';
  }
  document.querySelector('#viewer-content').innerHTML = `<div class="viewer-art">${html}</div><aside><span class="eyebrow">${t('archiveTitle')}</span><h2 id="viewer-title">${esc(title)}</h2>${description ? `<p>${esc(description)}</p>` : ''}${status ? `<small>${status}</small>` : ''}</aside>`;
}

function showIdea() { openViewer({type: 'idea'}); }
function goHome(section = 'explore') {
  if (dialog.open) dialog.close();
  closeDestinationGallery({navigate:false});
  viewerState = null; currentNav = 'explore';
  history.pushState({}, '', '#explore'); renderMap(); window.scrollTo(0, 0);
  if (section === 'journeys') openArchive();
}
function switchLanguage(nextLanguage) {
  if (nextLanguage === language) return;
  const scrollY = window.scrollY;
  language = nextLanguage;
  try { storage?.setItem('dream-journey-language', language); } catch { /* Keep working without persistence. */ }
  projects = getProjects(language, publishedProjects); stages = getStages(language);
  updateHeader();
  if (selected) { selected = projects[active]; renderProject(); } else renderMap();
  if (galleryDestination && !selected) renderDestinationGallery();
  if (viewerState) renderViewer();
  projectAgent.refreshLocale(); account.refreshLocale();
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
const projectAgent = createProjectAgent({getLanguage: () => language, t, onPublished: project => {
  if (!publishedProjects.some(record => record.id === project.id)) publishedProjects.push(project);
  projects = getProjects(language, publishedProjects);
  active = Math.max(0, projects.findIndex(record => record.id === project.id));
  goHome();
}});
let lastAccountId;
const account = createAccount({t, onChange: user => {
  if (lastAccountId && lastAccountId !== user?.id) projectAgent.clear();
  lastAccountId = user?.id; refreshAccountControls();
  if (user?.role === 'donor') mountSponsorStars(document.querySelector('.globe')); else destroySponsorStars();
}});
document.querySelector('#new-project').onclick = openProjectAssistant;
document.querySelectorAll('[data-language]').forEach(button => button.onclick = () => switchLanguage(button.dataset.language));
function init() {
  if (dialog.open) dialog.close(); viewerState = null;
  closeDestinationGallery({navigate:false});
  const match = location.hash.match(/^#(journey|gallery)\/(.+)$/);
  const index = match ? projects.findIndex(p => p.id === match[2]) : -1;
  if (index >= 0 && match[1] === 'journey') {
    active = index; selected = projects[index]; renderProject(); window.scrollTo(0, 0);
  } else {
    currentNav = 'explore'; renderMap();
    if (index >= 0 && match[1] === 'gallery') openDestination(index, {push:false, animate:false});
    else if (location.hash === '#journeys') openArchive({push:false});
  }
}
window.addEventListener('popstate', init);
window.addEventListener('hashchange', () => {
  const expected = selected ? `#journey/${selected.id}` : galleryDestination === '*' ? '#journeys' : galleryDestination ? `#gallery/${galleryDestination}` : '#explore';
  if (location.hash !== expected) init();
});
updateHeader(); init(); account.refresh();
loadPublishedProjects().then(records => {
  const currentId = selected?.id || projects[active]?.id;
  publishedProjects = [...new Map([...records, ...publishedProjects].map(project => [project.id, project])).values()];
  projects = getProjects(language, publishedProjects);
  active = Math.max(0, projects.findIndex(project => project.id === currentId));
  const match = location.hash.match(/^#(journey|gallery)\/(.+)$/);
  const requestedIndex = match ? projects.findIndex(project => project.id === match[2]) : -1;
  if (requestedIndex >= 0 && selected?.id !== match[2]) {
    active = requestedIndex;
    if (match[1] === 'journey') { selected = projects[active]; renderProject(); }
    else { renderMap(); openDestination(active, {push:false, animate:false}); }
  } else if (!selected) {
    const position = window.scrollY; renderMap(); window.scrollTo({top: position, behavior: 'instant'});
    if (galleryDestination) renderDestinationGallery();
  }
}).catch(() => { document.querySelector('#project-service-status').hidden = false; });
