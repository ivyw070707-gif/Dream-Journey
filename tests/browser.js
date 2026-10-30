import {getProjects} from '../src/js/data.js';
import {journeyContent} from '../src/js/journey-content.js';
import {impactData} from '../src/js/impact-data.js';
import {projectModels} from '../src/js/project-models.js';

const frame = document.querySelector('iframe'), output = document.querySelector('#results');
const runButton = document.querySelector('#run');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function until(predicate, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (predicate()) return; await wait(50); }
  throw new Error(`Timed out: ${description}`);
}
runButton.onclick = async () => {
  runButton.disabled = true;
  output.textContent = ''; output.className = '';
  let doc = frame.contentDocument, win = frame.contentWindow;
  const check = (condition, name) => {
    if (!condition) throw new Error(name);
    output.textContent += `PASS ${name}\n`;
  };
  const click = selector => {
    const element = doc.querySelector(selector);
    if (!element) throw new Error(`Missing control: ${selector}`);
    element.click();
  };
  const ready = () => until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'WebGL globe');
  const setLanguage = async language => {
    if (doc.documentElement.lang !== language) click('#language');
    await ready();
  };
  const fitsScreen = label => {
    check(doc.documentElement.scrollWidth <= win.innerWidth + 1 && doc.documentElement.scrollHeight <= win.innerHeight + 1, `${label}: document fits one screen`);
    for (const selector of ['#right-column','.project-book','#tab-content']) {
      const node = doc.querySelector(selector);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      check(rect.left >= -1 && rect.top >= -1 && rect.right <= win.innerWidth+1 && rect.bottom <= win.innerHeight+1, `${label}: ${selector} stays in the viewport`);
      check(node.scrollWidth <= node.clientWidth+1 && node.scrollHeight <= node.clientHeight+1, `${label}: ${selector} has no hidden overflowing content`);
    }
  };
  try {
    frame.style.width = '1200px'; frame.style.height = '850px';
    await new Promise(resolve => {frame.addEventListener('load',resolve,{once:true});win.location.reload();});
    doc=frame.contentDocument;win=frame.contentWindow;
    await ready(); click('#home'); await setLanguage('zh-CN');
    check(doc.querySelectorAll('.globe-marker').length === 4, 'Only the four project destinations are marked on the globe');
    check(!doc.querySelector('.intro,.place-picker,.map-note,.globe-help,footer'), 'The enlarged globe has no surrounding slogans or duplicate place list');
    check(doc.querySelectorAll('.impact-stats strong').length === impactData.stats.length, 'Homepage displays the sourced impact figures');
    check(doc.querySelector('.source-note a').href === impactData.sourceUrl, 'Official source link accompanies the impact figures');
    await until(() => doc.querySelector('#hero-photo')?.naturalWidth > 0, 'Homepage photo');
    check(doc.querySelector('.photo-diary').children.length === 1 && doc.querySelector('.photo-diary').firstElementChild.matches('img'), 'Homepage slideshow contains only the image');
    check(!doc.querySelector('.photo-diary').textContent.trim(), 'Slideshow has no labels, captions or control text');
    fitsScreen('Desktop homepage');
    const firstPhoto = doc.querySelector('#hero-photo').src;
    await until(() => doc.querySelector('#hero-photo').src !== firstPhoto, 'Automatic photo advance', 7000);
    await until(() => doc.querySelector('#hero-photo')?.naturalWidth > 0, 'Next automatic photo');
    check(true, 'The supplied image slideshow advances automatically without interaction');
    const initialDistance = Number(doc.querySelector('.globe').dataset.distance);
    const overviewLongitude = Number(doc.querySelector('.globe').dataset.longitude);
    click('[data-globe="in"]');
    await until(() => Number(doc.querySelector('.globe').dataset.distance) < initialDistance, 'Zoom in');
    const zoomed = doc.querySelector('.globe').dataset.distance;
    await setLanguage('en');
    check(Math.abs(Number(doc.querySelector('.globe').dataset.distance) - Number(zoomed)) < 0.01, 'Language switching preserves globe zoom');
    await setLanguage('zh-CN');
    const globeCanvas = doc.querySelector('.globe canvas');
    const longitudeBefore = Number(doc.querySelector('.globe').dataset.longitude);
    globeCanvas.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true}));
    await until(() => Math.abs(Number(doc.querySelector('.globe').dataset.longitude) - longitudeBefore) > 1, 'Rotate globe to the right');
    const longitudeRight = Number(doc.querySelector('.globe').dataset.longitude);
    globeCanvas.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowLeft',cancelable:true}));
    await until(() => Math.abs(Number(doc.querySelector('.globe').dataset.longitude) - longitudeRight) > 1, 'Rotate globe to the left');
    check(Math.abs(Number(doc.querySelector('.globe').dataset.longitude) - longitudeBefore) < 0.1, 'Left and right rotation return to the same geographic view');
    for (let i=0;i<20;i++) globeCanvas.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true}));
    await until(() => Math.abs(Number(doc.querySelector('.globe').dataset.longitude) - longitudeBefore) > 40, 'Free rotation past the former China-only limit');
    const beforeZoomOut = Number(doc.querySelector('.globe').dataset.distance);
    click('[data-globe="out"]');
    await until(() => Number(doc.querySelector('.globe').dataset.distance) > beforeZoomOut, 'Zoom out');
    click('[data-globe="reset"]');
    await until(() => Math.abs(Number(doc.querySelector('.globe').dataset.longitude) - overviewLongitude) < 0.1, 'China overview reset');
    check(true, 'Globe supports free horizontal rotation, zoom and overview reset');
    for (const [i, project] of getProjects('zh').entries()) {
      click(`.globe-marker[data-i="${i}"]`);
      check(win.location.hash === `#journey/${project.id}` && doc.querySelector('.book-title h2').textContent === project.title, `${project.destination} opens the correct project beside the map`);
      check(doc.querySelector('.globe canvas') === globeCanvas, 'Opening a project retains the existing globe canvas');
      check(doc.querySelector('.reading-body .summary').textContent === journeyContent[project.id].summary, `${project.destination} shows its sourced research narrative`);
      check(!doc.querySelector('#text-prev,#text-next'), 'Notes show one continuous article without pagination');
      const notes=doc.querySelector('.reading-page');
      check(doc.querySelectorAll('.research-step').length===journeyContent[project.id].steps.length, 'All research stages appear in the same article');
      check(notes.textContent.includes(journeyContent[project.id].sourceNote), 'The same article includes the source note');
      check(['auto','scroll'].includes(win.getComputedStyle(notes).overflowY), 'Notes allow vertical scrolling inside their panel');
      if(notes.scrollHeight>notes.clientHeight+1){
        notes.scrollTop=notes.scrollHeight; await wait(50);
        check(notes.scrollTop>0 && win.scrollY===0, 'Reading the end scrolls only the article, not the whole page');
        notes.scrollTop=0;
      }
      if(journeyContent[project.id].isExample)check(notes.textContent.includes('示例'), 'The rewritten Suzhou narrative is identified as an example');
      fitsScreen(`${project.destination} continuous notes`);
      click('#tab-photos');
      check(doc.querySelector('#tab-photos').getAttribute('aria-selected') === 'true' && doc.querySelector('#tab-content').getAttribute('aria-labelledby') === 'tab-photos', 'Photo tab exposes its selected state and panel label');
      check(doc.querySelector('#detail-photo img').getAttribute('src') === project.cover, 'First photo preserves the supplied project cover');
      click('#photo-next');
      await until(() => doc.querySelector('#detail-photo img')?.naturalWidth > 0, `${project.destination} supplied photograph`);
      check(doc.querySelector('#detail-photo img').getAttribute('src') === journeyContent[project.id].photos[0].src, 'Photo paging opens the supplied project material');
      fitsScreen(`${project.destination} photos`);
      click('#detail-photo');
      await until(() => doc.querySelector('.lightbox img')?.naturalWidth > 0, 'Lightbox image');
      check(doc.querySelector('#viewer').open, 'Photo opens in the lightbox');
      click('.close'); click('#back-home');
      check(!doc.querySelector('.project-book') && doc.querySelector('.globe canvas') === globeCanvas, 'Return to all journeys retains the globe');
    }
    for(const [i,project] of getProjects('zh').entries()) {
      click(`.globe-marker[data-i="${i}"]`);click('#tab-models');
      const model=projectModels[project.id];
      if(model){
        check(doc.querySelector('.model-title')?.textContent===model.name, `${project.destination} shows its assigned 3D work title`);
        check(!doc.querySelector('.model-picker,[data-model]'), 'A project does not offer another project’s model');
        await until(()=>doc.querySelector('#model-stage canvas'), `${project.destination} assigned WebGL model`,45000);
        click('#reset-model');
        check(!doc.querySelector('.model-empty'), 'Assigned model replaces the empty state');
      }else{
        check(doc.querySelector('.model-empty')?.textContent.includes('暂无3D作品'), `${project.destination} explicitly has no 3D work`);
        check(!doc.querySelector('#model-stage, .model-title, #reset-model'), 'A missing work does not display a fallback model or model controls');
      }
      check(doc.querySelector('.globe canvas')===globeCanvas, 'Per-project artwork does not recreate the globe');
      fitsScreen(`${project.destination} 3D panel`);
    }
    // A late model load must not populate another project's deliberately empty panel.
    click('.globe-marker[data-i="1"]');click('#tab-models');
    click('.globe-marker[data-i="0"]');click('#tab-models');await wait(500);
    check(doc.querySelector('.model-empty') && !doc.querySelector('#model-stage canvas'), 'Switching away during model loading keeps a missing-model panel empty');
    click('.globe-marker[data-i="1"]');click('#tab-text');const hash=win.location.hash;
    await setLanguage('en');
    check(win.location.hash===hash && doc.querySelector('.book-title h2').textContent===getProjects('en')[1].title && doc.querySelector('#tab-photos').textContent.includes('Photos'), 'Language switching preserves project selection and translates controls');
    await setLanguage('zh-CN');
    check(doc.querySelector('#upload').hidden, 'Visitors do not see the teacher upload control');
    check(!!doc.querySelector('#account-button'), 'Visitors have a sign-in control');
    click('#back-home'); win.history.back();
    await until(() => doc.querySelector('.project-book'), 'Browser Back restores project');
    win.history.forward();
    await until(() => !doc.querySelector('.project-book'), 'Browser Forward returns home');
    check(true, 'Browser Back and Forward preserve home/project navigation');
    frame.style.width = '1366px'; frame.style.height = '768px'; await wait(250);
    fitsScreen('1366×768 homepage'); click('.globe-marker[data-i="1"]'); await wait(150);
    fitsScreen('1366×768 text page'); click('#tab-photos'); await wait(100); fitsScreen('1366×768 photo page');
    click('#tab-models');
    await until(() => doc.querySelector('#model-stage canvas'), '1366×768 artwork', 45000);
    fitsScreen('1366×768 3D artwork');
    await new Promise(resolve => {frame.addEventListener('load',resolve,{once:true});win.location.reload();});
    doc=frame.contentDocument;win=frame.contentWindow;await ready();
    check(doc.documentElement.lang === 'zh-CN', 'Saved language survives reload');
    doc.querySelector('.globe canvas').dispatchEvent(new win.Event('webglcontextlost',{cancelable:true}));
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'fallback', 'WebGL fallback');
    click('.globe-marker[data-i="1"]');
    check(doc.querySelector('.book-title h2').textContent === getProjects('zh')[1].title, 'Project markers remain usable when WebGL is unavailable');
    output.textContent += '\nALL BROWSER CHECKS PASSED';
  } catch (error) {
    output.className = 'fail'; output.textContent += `\nFAIL ${error.message}`;
  } finally { runButton.disabled=false; }
};
