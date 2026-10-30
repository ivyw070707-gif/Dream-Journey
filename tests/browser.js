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
    check(doc.querySelectorAll('.globe-marker').length === 4, 'Exactly four confirmed destinations remain on the map');
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
    for (const [index, project] of getProjects(doc.documentElement.lang === 'en' ? 'en' : 'zh').entries()) {
      const marker = doc.querySelector(`.globe-marker[data-i="${index}"]`);
      marker.click();
      const gallery = doc.querySelector('#destination-gallery');
      check(gallery.open && win.location.hash === `#gallery/${project.id}`, `${project.destination}: marker opens the destination gallery`);
      check(win.getComputedStyle(gallery, '::backdrop').backdropFilter.includes('blur'), 'The map behind the gallery is blurred');
      check(gallery.querySelectorAll('.destination-poster').length === 1 && gallery.querySelector('img').getAttribute('src') === project.cover, `${project.destination}: only the matching supplied poster is shown`);
      gallery.querySelector('.destination-poster').click();
      check(!gallery.open && win.location.hash === `#journey/${project.id}` && doc.querySelector('.project-opening h1').textContent === project.title, `${project.destination}: poster opens the correct project page`);
      check(!doc.querySelector('.project .placeholder,.project .media-slot,.research,.fieldwork,.outcomes,.ending'), 'Empty project fields and whole empty sections are hidden');
      if (index === 1) {
        win.history.back(); await until(() => gallery.open, 'Back restores destination gallery');
        check(win.location.hash === '#gallery/suzhou' && gallery.querySelector('img').getAttribute('src') === project.cover, 'Browser Back restores the same poster gallery');
        win.history.forward(); await until(() => doc.querySelector('.project'), 'Forward restores project');
      }
      doc.querySelector('#home').click();
      await until(() => doc.querySelector('.globe')?.dataset.ready, 'Return to map');
    }
    doc.querySelector('.globe-marker[data-i="1"]').click();
    doc.querySelector('#destination-gallery').dispatchEvent(new Event('cancel', {cancelable:true}));
    check(!doc.querySelector('#destination-gallery').open && win.location.hash === '#explore', 'Escape closes the gallery and returns to the clean map');
    doc.querySelector('.globe-marker[data-i="2"]').click();
    doc.querySelector('.gallery-close').click();
    check(!doc.querySelector('#destination-gallery').open, 'Visible close control dismisses the gallery');
    frame.style.width = '390px'; await wait(150);
    check(doc.documentElement.scrollWidth <= win.innerWidth, '390px homepage has no horizontal overflow');
    doc.querySelector('.globe-marker[data-i="1"]').click(); await wait(100);
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
    doc.querySelector('.globe-marker[data-i="1"]').click();
    check(doc.querySelector('#destination-gallery-title').textContent === 'Suzhou', 'Gallery titles use the selected language');
    doc.querySelector('.gallery-close').click();
    output.textContent += '\nALL BROWSER CHECKS PASSED';
  } catch (error) { output.className = 'fail'; output.textContent += `\nFAIL ${error.message}`; }
};
