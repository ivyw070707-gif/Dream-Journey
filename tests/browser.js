import {getProjects} from '../src/js/data.js';
const frame = document.querySelector('iframe'), output = document.querySelector('#results');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(predicate, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (predicate()) return; await wait(50); }
  throw new Error(`Timed out: ${description}`);
}
document.querySelector('#run').onclick = async () => {
  output.textContent = ''; output.className = '';
  const check = (condition, name) => { if (!condition) throw new Error(name); output.textContent += `PASS ${name}\n`; };
  try {
    let doc = frame.contentDocument, win = frame.contentWindow;
    await until(() => doc.querySelector('.globe')?.dataset.ready, 'Map startup');
    check(win.getComputedStyle(doc.querySelector('header')).display === 'none', 'Homepage hides navigation, branding and language controls');
    check(doc.querySelectorAll('#app > section').length === 1 && doc.querySelector('.entrance-title').textContent === '去远方', 'Homepage contains only the title and map section');
    check(!doc.querySelector('.archive,.atlas-coda,.question-panel,footer'), 'No poster archive, project text, story or footer on first screen');
    check(doc.querySelectorAll('.globe-marker').length === 4, 'Four unique destinations remain on the map');
    check(!doc.querySelector('#destination-gallery').open, 'Poster gallery is closed on arrival');
    if (doc.querySelector('.globe').dataset.ready === 'true') {
      const initial = Number(doc.querySelector('.globe').dataset.distance);
      doc.querySelector('[data-globe="in"]').click(); await wait(100);
      check(Number(doc.querySelector('.globe').dataset.distance) < initial, 'WebGL camera still supports zoom');
      for (let i = 0; i < 100; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight'}));
      await wait(100); check(Number(doc.querySelector('.globe').dataset.longitude) === 135, '3D navigation stays bounded to China');
      doc.querySelector('[data-globe="reset"]').click();
    } else {
      check(win.getComputedStyle(doc.querySelector('.globe')).backgroundImage.includes('china-preview.svg'), 'Illustrated geographic map is visible without WebGL');
    }
    const projects = getProjects('zh');
    const markerIndexes = [...doc.querySelectorAll('.globe-marker')].map(marker => Number(marker.dataset.i));
    for (const index of markerIndexes) {
      const project = projects[index];
      const entries = projects.filter(candidate => candidate.destination === project.destination);
      const marker = doc.querySelector(`.globe-marker[data-i="${index}"]`), gallery = doc.querySelector('#destination-gallery');
      marker.click();
      if (project.destination === '漳州') {
        await until(() => doc.querySelector('.journey-route-playback'), 'Zhangzhou route animation');
        check(!gallery.open && doc.querySelectorAll('.journey-route-svg path').length === entries.length, 'All arrival routes play before the destination gallery');
        check(!doc.querySelector('.route-playback-status,.journey-route-playback button'), 'Route animation has no text status or skip control');
      }
      await until(() => gallery.open, `${project.destination} gallery`);
      check(win.location.hash === `#gallery/${project.id}`, `${project.destination}: marker opens the destination gallery after routes`);
      check(win.getComputedStyle(gallery, '::backdrop').backdropFilter.includes('blur'), 'The map behind the gallery is blurred');
      check(gallery.querySelectorAll('.destination-poster').length === entries.length, `${project.destination}: every journey cover is shown`);
      const poster = project.destination === '漳州' ? gallery.querySelector('.destination-poster.featured') : gallery.querySelector('.destination-poster');
      if (project.destination === '漳州') {
        await wait(100);
        const container = gallery.querySelector('.destination-posters').getBoundingClientRect(), featured = poster.getBoundingClientRect();
        check(Math.abs((featured.left + featured.width / 2) - (container.left + container.width / 2)) < 2, 'The complete Tulou journey is centered in the gallery');
      }
      poster.click();
      const selected = projects[Number(poster.dataset.project)];
      check(!gallery.open && win.location.hash === `#journey/${selected.id}` && doc.querySelector('.project-opening h1').textContent === selected.title, `${project.destination}: poster opens the correct project page`);
      if (selected.id === 'tulou') check(doc.querySelector('.research,.fieldwork,.outcomes,.ending') && doc.querySelectorAll('.star-node').length === 10, 'The complete Tulou journey displays its research and outcomes');
      else check(!doc.querySelector('.project .placeholder,.project .media-slot,.research,.outcomes,.ending'), 'Empty project fields and whole empty sections are hidden');
      if (project.id === 'suzhou') {
        win.history.back(); await until(() => gallery.open, 'Back restores destination gallery');
        check(win.location.hash === '#gallery/suzhou' && gallery.querySelector('img').getAttribute('src') === project.cover, 'Browser Back restores the same poster gallery');
        win.history.forward(); await until(() => doc.querySelector('.project'), 'Forward restores project');
      }
      doc.querySelector('#home').click();
      await until(() => doc.querySelector('.globe')?.dataset.ready, 'Return to map');
    }
    const suzhouIndex = projects.findIndex(project => project.id === 'suzhou'), dunhuangIndex = projects.findIndex(project => project.id === 'dunhuang');
    doc.querySelector(`.globe-marker[data-i="${suzhouIndex}"]`).click();
    await until(() => doc.querySelector('#destination-gallery').open, 'Suzhou gallery');
    doc.querySelector('#destination-gallery').dispatchEvent(new Event('cancel', {cancelable:true}));
    check(!doc.querySelector('#destination-gallery').open && win.location.hash === '#explore', 'Escape closes the gallery and returns to the clean map');
    doc.querySelector(`.globe-marker[data-i="${dunhuangIndex}"]`).click();
    await until(() => doc.querySelector('#destination-gallery').open, 'Dunhuang gallery');
    doc.querySelector('.gallery-close').click();
    check(!doc.querySelector('#destination-gallery').open, 'Visible close control dismisses the gallery');
    frame.style.width = '390px'; await wait(150);
    check(doc.documentElement.scrollWidth <= win.innerWidth, '390px homepage has no horizontal overflow');
    doc.querySelector(`.globe-marker[data-i="${suzhouIndex}"]`).click();
    await until(() => doc.querySelector('#destination-gallery').open, 'Mobile gallery');
    const poster = doc.querySelector('.destination-poster').getBoundingClientRect();
    check(poster.width <= win.innerWidth && doc.querySelector('#destination-gallery').scrollWidth <= win.innerWidth, '390px gallery keeps its poster and caption in view');
    doc.querySelector('.destination-poster').click();
    doc.querySelector('header [data-language="en"]').click();
    check(doc.querySelector('.project-opening h1').textContent === 'A Study Journey to Suzhou', 'Project language switch still works');
    doc.querySelector('.inspect').click();
    check(doc.querySelector('#viewer').open && doc.querySelector('.viewer-art img'), 'Project artifact inspection still works');
    doc.querySelector('.close').click(); await wait(30);
    doc.querySelector('#home').click();
    await until(() => doc.querySelector('.globe')?.dataset.ready, 'English map');
    doc.querySelector(`.globe-marker[data-i="${suzhouIndex}"]`).click();
    await until(() => doc.querySelector('#destination-gallery').open, 'English gallery');
    check(doc.querySelector('#destination-gallery-title').textContent === 'Suzhou', 'Gallery titles use the selected language');
    doc.querySelector('.gallery-close').click();
    output.textContent += '\nALL BROWSER CHECKS PASSED';
  } catch (error) { output.className = 'fail'; output.textContent += `\nFAIL ${error.message}`; }
};
