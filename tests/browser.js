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
    await until(() => frame.contentDocument?.querySelector('.globe')?.dataset.ready, 'Globe startup');
    let doc = frame.contentDocument, win = frame.contentWindow;
    doc.querySelector('header [data-language="en"]').click();
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'WebGL globe');
    check(doc.querySelector('#explore').getAttribute('aria-current') === 'page', 'Explore is active on the homepage');
    check(doc.querySelectorAll('.globe-marker').length === 4 && doc.querySelectorAll('.artifact').length === 4, 'Exactly four destinations and four covers are available');
    check(doc.querySelector('#counter').textContent === '01 / 04', 'Archive counter uses the four supplied journeys');
    check([...doc.querySelectorAll('.artifact img')].every((img, i) => img.getAttribute('src') === getProjects('en')[i].cover), 'Gallery uses the supplied cover images');
    const initial = Number(doc.querySelector('.globe').dataset.distance);
    doc.querySelector('[data-globe="in"]').click(); await wait(100);
    check(Number(doc.querySelector('.globe').dataset.distance) < initial, 'Zoom in changes the 3D camera');
    const zoomed = doc.querySelector('.globe').dataset.distance;
    doc.querySelector('header [data-language="zh"]').click();
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'Globe after language switch');
    check(doc.querySelector('.globe').dataset.distance === zoomed, 'Language switch preserves globe zoom');
    doc.querySelector('header [data-language="en"]').click();
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'English globe');
    for (let i = 0; i < 50; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.longitude) === 135, 'Eastward navigation is clamped to China');
    for (let i = 0; i < 100; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.longitude) === 73, 'Westward navigation is clamped to China');
    for (let i = 0; i < 50; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.latitude) === 53, 'Northward navigation is clamped to China');
    for (let i = 0; i < 100; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.latitude) === 18, 'Southward navigation is clamped to China');
    for (let i = 0; i < 50; i++) doc.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', {deltaY: -10000, cancelable: true}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.distance) === 1.65, 'Wheel zoom stops before entering the globe');
    doc.querySelector('[data-globe="reset"]').click(); await wait(100);
    check(Number(doc.querySelector('.globe').dataset.longitude) === 104, 'Reset returns to China overview');
    for (const [index, project] of getProjects('en').entries()) {
      doc.querySelector(`.globe-marker[data-i="${index}"]`).click(); doc.querySelector('#enter').click();
      check(win.location.hash === `#journey/${project.id}` && doc.querySelector('.project-opening h1').textContent === project.title, `${project.destination} destination opens the correct journey`);
      check(doc.querySelectorAll('.project img').length === 1 && doc.querySelector('.project img').getAttribute('src') === project.cover, `${project.destination} shows only its real cover and empty content slots`);
      doc.querySelector('#home').click();
      await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'Return to globe');
    }
    doc.querySelector('.globe-marker[data-i="0"]').click(); doc.querySelector('#enter').click();
    check(doc.querySelector('#journeys').getAttribute('aria-current') === 'page' && !doc.querySelector('#explore').hasAttribute('aria-current'), 'Journey detail highlights Journeys exclusively');
    check(doc.querySelector('.route-sketch') && doc.querySelector('.route-transport').textContent === 'Transport to be added', 'Hand-drawn route leaves unknown transport empty');
    const hash = win.location.hash;
    doc.querySelector('header [data-language="zh"]').click();
    check(doc.documentElement.lang === 'zh-CN' && win.location.hash === hash && doc.querySelector('.project-opening h1').textContent === '土楼研学报告', 'Language switch translates the current project without navigation');
    doc.querySelector('.inspect').click();
    check(doc.querySelector('dialog').open && doc.querySelector('.viewer-art img').getAttribute('src') === getProjects('zh')[0].cover, 'Cover opens at its original aspect ratio');
    doc.querySelector('.close').click(); await wait(50);
    doc.querySelector('[data-stage="5"]').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    check(doc.querySelector('dialog').open && doc.querySelector('#viewer-title').textContent === '老师的追问' && doc.querySelector('.viewer-art h3').textContent === '待补充', 'Research nodes contain empty slots instead of invented stories');
    doc.querySelector('dialog [data-language="en"]').click();
    check(doc.querySelector('#viewer-title').textContent === 'A teacher’s question', 'Open content slots translate with the language');
    doc.querySelector('.close').click(); await wait(50);
    for (const element of doc.querySelectorAll('[data-outcome]')) {
      element.click(); check(doc.querySelector('dialog').open && doc.querySelector('.viewer-art .media-slot'), `Outcome ${Number(element.dataset.outcome) + 1} retains an empty upload slot`); doc.querySelector('.close').click(); await wait(20);
    }
    doc.querySelector('#impact').click();
    check(doc.querySelector('#impact').getAttribute('aria-current') === 'page', 'The idea highlights while its dialog is open');
    doc.querySelector('.close').click(); await wait(50);
    check(doc.querySelector('#journeys').getAttribute('aria-current') === 'page', 'Closing The idea restores the journey highlight');
    win.history.back(); await until(() => doc.querySelector('.atlas'), 'Browser back');
    check(!doc.querySelector('.project'), 'Browser Back returns to the atlas');
    win.history.forward(); await until(() => doc.querySelector('.project'), 'Browser forward');
    check(doc.querySelector('#journeys').getAttribute('aria-current') === 'page', 'Browser Forward restores project and navigation');
    frame.style.width = '390px'; await wait(150);
    check(doc.documentElement.scrollWidth <= win.innerWidth, '390px project has no page overflow');
    doc.querySelector('#home').click(); await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'Mobile globe');
    check(doc.documentElement.scrollWidth <= win.innerWidth, '390px homepage has no page overflow');
    doc.querySelector('header [data-language="zh"]').click(); await wait(100);
    await new Promise(resolve => { frame.addEventListener('load', resolve, {once: true}); frame.contentWindow.location.reload(); });
    await until(() => frame.contentDocument.querySelector('.globe')?.dataset.ready, 'Reload with language preference');
    doc = frame.contentDocument; win = frame.contentWindow;
    check(doc.documentElement.lang === 'zh-CN', 'Saved language survives page reload');
    doc.querySelector('canvas').dispatchEvent(new Event('webglcontextlost', {cancelable: true}));
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'fallback', 'WebGL fallback');
    check(doc.querySelectorAll('.globe-fallback .globe-marker:not([hidden])').length === 4, 'All four destinations remain accessible without WebGL');
    doc.querySelector('.globe-marker[data-i="1"]').click(); doc.querySelector('#enter').click();
    check(doc.querySelector('.project-opening h1').textContent === '苏州研学之旅', 'Fallback destination still opens its journey');
    output.textContent += '\nALL BROWSER CHECKS PASSED';
  } catch (error) { output.className = 'fail'; output.textContent += `\nFAIL ${error.message}`; }
};
