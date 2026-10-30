const frame = document.querySelector('iframe'), output = document.querySelector('#results');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(predicate, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (predicate()) return; await wait(50); }
  throw new Error(`Timed out: ${description}`);
}
document.querySelector('#run').onclick = async () => {
  output.textContent = '';
  const check = (condition, name) => { if (!condition) throw new Error(name); output.textContent += `PASS ${name}\n`; };
  try {
    await until(() => frame.contentDocument?.querySelector('.globe')?.dataset.ready, 'Globe startup');
    let doc = frame.contentDocument, win = frame.contentWindow;
    doc.querySelector('[data-language="en"]').click();
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'WebGL globe');
    check(doc.querySelector('#explore').getAttribute('aria-current') === 'page', 'Explore is active on the homepage');
    const initial = Number(doc.querySelector('.globe').dataset.distance);
    doc.querySelector('[data-globe="in"]').click(); await wait(100);
    check(Number(doc.querySelector('.globe').dataset.distance) < initial, 'Zoom in changes the 3D camera');
    for (let i = 0; i < 50; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.longitude) === 135, 'Eastward navigation is clamped to China');
    for (let i = 0; i < 100; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.longitude) === 73, 'Westward navigation is clamped to China');
    for (let i = 0; i < 50; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.latitude) === 53, 'Northward navigation is clamped to China');
    for (let i = 0; i < 100; i++) doc.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown'}));
    await wait(100); check(Number(doc.querySelector('.globe').dataset.latitude) === 18, 'Southward navigation is clamped to China');
    const wheel = new WheelEvent('wheel', {deltaY: -10000, cancelable: true});
    for (let i = 0; i < 50; i++) doc.querySelector('canvas').dispatchEvent(wheel);
    await wait(100); check(Number(doc.querySelector('.globe').dataset.distance) === 1.65, 'Wheel zoom stops before entering the globe');
    doc.querySelector('[data-globe="reset"]').click(); await wait(100);
    check(Number(doc.querySelector('.globe').dataset.longitude) === 104, 'Reset returns to China overview');
    doc.querySelector('#enter').click();
    check(doc.querySelector('#journeys').getAttribute('aria-current') === 'page' && !doc.querySelector('#explore').hasAttribute('aria-current'), 'Journey detail highlights Journeys exclusively');
    check(doc.querySelector('.route-sketch') && !doc.querySelector('.journey-route i'), 'Journey contains an illustrated route');
    const hash = win.location.hash;
    doc.querySelector('[data-language="zh"]').click();
    check(doc.documentElement.lang === 'zh-CN' && win.location.hash === hash && doc.querySelector('.project-opening h1').textContent.includes('木屋'), 'Language switch translates the current project without navigation');
    doc.querySelector('[data-stage="5"]').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    check(doc.querySelector('dialog').open && doc.querySelector('#viewer-title').textContent === '老师的追问', 'Research node opens the Chinese artifact');
    doc.querySelector('dialog [data-language="en"]').click();
    check(doc.querySelector('#viewer-title').textContent === 'A teacher’s question', 'Open artifacts translate with the language');
    doc.querySelector('.close').click(); await wait(50);
    for (const element of doc.querySelectorAll('[data-outcome]')) {
      element.click(); check(doc.querySelector('dialog').open, `Outcome ${Number(element.dataset.outcome) + 1} opens`); doc.querySelector('.close').click(); await wait(20);
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
    doc.querySelector('[data-language="zh"]').click(); await wait(100);
    await new Promise(resolve => {
      frame.addEventListener('load', resolve, {once: true});
      frame.contentWindow.location.reload();
    });
    await until(() => frame.contentDocument.querySelector('.globe')?.dataset.ready, 'Reload with language preference');
    doc = frame.contentDocument; win = frame.contentWindow;
    check(doc.documentElement.lang === 'zh-CN', 'Saved language survives page reload');
    doc.querySelector('canvas').dispatchEvent(new Event('webglcontextlost', {cancelable: true}));
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'fallback', 'WebGL fallback');
    check(doc.querySelectorAll('.globe-fallback .globe-marker:not([hidden])').length === 7, 'All seven journeys remain accessible without WebGL');
    doc.querySelector('.globe-marker[data-i="3"]').click(); doc.querySelector('#enter').click();
    check(doc.querySelector('.project-opening h1').textContent.includes('小鸟'), 'Fallback destination still opens its journey');
    output.textContent += '\nALL BROWSER CHECKS PASSED';
  } catch (error) { output.className = 'fail'; output.textContent += `\nFAIL ${error.message}`; }
};
