// Explicit, real-backend checks for the isolated localhost:8767 test server only.
// All created data lives in that server's configured temporary JOURNEY_DATA_DIR.
const frame = document.querySelector('iframe'), output = document.querySelector('#results'), runButton = document.querySelector('#run');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
let doc, win;
async function until(predicate, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await wait(50); }
  const error = doc?.querySelector('.account-error,.agent-error')?.textContent?.trim();
  throw new Error(`Timed out: ${label}${error ? ` (${error})` : ''}`);
}
async function api(route, body, csrfToken) {
  const response = await fetch(new URL(`../api/${route}`, document.baseURI), {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store',
    headers: body === undefined ? {} : {'Content-Type':'application/json','X-Journey-Request':'1',...(csrfToken ? {'X-CSRF-Token':csrfToken} : {})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)})
  });
  return {response, payload:await response.json()};
}
async function loadFrame() {
  await new Promise(resolve => {frame.addEventListener('load', resolve, {once:true});frame.contentWindow.location.reload();});
  doc=frame.contentDocument;win=frame.contentWindow;
  await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'globe and application startup');
  if(doc.documentElement.lang !== 'zh-CN') {
    doc.querySelector('#language').click();
    await until(() => doc.querySelector('.globe')?.dataset.ready === 'true', 'Chinese application controls');
  }
  await until(() => Boolean(doc.body.dataset.role), 'account state');
}
const click = selector => {const element=doc.querySelector(selector);if(!element)throw new Error(`Missing control: ${selector}`);element.click();};
const fill = (selector,value) => {const element=doc.querySelector(selector);if(!element)throw new Error(`Missing field: ${selector}`);element.value=value;element.dispatchEvent(new win.Event('input',{bubbles:true}));};
const field = name => `[data-field="${name}"]`;
const screenshotFit = () => doc.documentElement.scrollWidth <= win.innerWidth + 1 && doc.documentElement.scrollHeight <= win.innerHeight + 1;
function visibleUpload() {const button=doc.querySelector('#upload');return !button.hidden && win.getComputedStyle(button).display!=='none';}
async function register(role, email, password) {
  click('#account-button');click('[data-mode="register"]');
  fill('#account-form [name="name"]',`Integration ${role}`);fill('#account-form [name="email"]',email);
  fill('#account-form [name="password"]',password);fill('#account-form [name="confirmation"]',password);
  doc.querySelector(`#account-form [name="role"][value="${role}"]`).checked=true;
  click('.account-submit');
  await until(() => doc.body.dataset.role===role && doc.querySelector('.account-logout'), `${role} registration`);
}
async function logoutUI() {
  if(!doc.querySelector('#account-dialog').open)click('#account-button');
  click('.account-logout');await until(()=>doc.body.dataset.role==='visitor'&&!doc.querySelector('#account-dialog').open,'sign-out');
}
async function openUpload() {
  click('#upload');await until(()=>doc.querySelector('#project-agent').open && doc.querySelector('.agent-publish') && !doc.querySelector('.agent-publish').disabled,'teacher upload dialog');
}
async function addFixtures() {
  const transfer=new win.DataTransfer();
  for(const [url,name,mime] of [
    ['fixtures/research-notes.docx','integration-report.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['fixtures/model.glb','integration-model.glb','model/gltf-binary'],
    ['fixtures/research-bundle.zip','integration-bundle.zip','application/zip']
  ]) {
    const response=await fetch(new URL(url,document.baseURI));if(!response.ok)throw new Error(`Missing fixture: ${name}`);
    transfer.items.add(new win.File([await response.arrayBuffer()],name,{type:mime}));
  }
  // Two small valid PNGs test independent cover and field-image publication.
  const image=doc.createElement('canvas');image.width=16;image.height=16;const paint=image.getContext('2d');paint.fillStyle='#cbd9be';paint.fillRect(0,0,16,16);
  const imageBytes=Uint8Array.from(atob(image.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));
  transfer.items.add(new win.File([imageBytes],'integration-cover.png',{type:'image/png'}));
  transfer.items.add(new win.File([imageBytes],'integration-field.png',{type:'image/png'}));
  const input=doc.querySelector('#agent-files');input.files=transfer.files;input.dispatchEvent(new win.Event('change',{bubbles:true}));
  await until(()=>doc.querySelectorAll('.agent-file').length===6 && doc.querySelector('.agent-workspace').getAttribute('aria-busy')==='false','document/image/ZIP/GLB file import');
}
runButton.onclick=async()=>{
  if(!['127.0.0.1','localhost'].includes(location.hostname)||location.port!=='8767'||!document.querySelector('#temporary-store').checked){
    output.className='fail';output.textContent='Use the isolated localhost:8767 test service and confirm its temporary data directory first.';return;
  }
  runButton.disabled=true;output.className='';output.textContent='';
  const check=(condition,label)=>{if(!condition)throw new Error(label);output.textContent+=`PASS ${label}\n`;};
  const runId=crypto.randomUUID().slice(0,8), password=`Integration-${runId}-pass`;
  const teacherEmail=`teacher-${runId}@example.test`,donorEmail=`donor-${runId}@example.test`;
  const projectTitle=`临时整合验收 ${runId} <em>原样文本</em>`, secondTitle=`临时同城验收 ${runId}`;
  let completed=false;
  try {
    let session=(await api('auth/me')).payload;
    if(session.user)await api('auth/logout',{},session.csrfToken);
    await loadFrame();
    await until(()=>doc.body.dataset.role==='visitor','anonymous visitor state');
    check(!visibleUpload()&&doc.querySelector('#upload').hidden,'Visitors see Sign in and never see Upload');
    check(doc.querySelector('#account-button').textContent==='登录','Anonymous header exposes the requested login control');
    for(const route of ['files/expand','agent/analyze','projects'])check((await api(route,{})).response.status===401,`Anonymous ${route} is rejected by the server`);
    await register('donor',donorEmail,password);
    check(!visibleUpload(),'Donor registration does not expose teacher upload');
    session=(await api('auth/me')).payload;
    for(const route of ['files/expand','agent/analyze','projects'])check((await api(route,{},session.csrfToken)).response.status===403,`Donor ${route} is rejected even with a valid session`);
    await logoutUI();await register('teacher',teacherEmail,password);
    check(visibleUpload(),'Teacher registration exposes Upload');
    await logoutUI();click('#account-button');fill('#account-form [name="email"]',teacherEmail);fill('#account-form [name="password"]',password);click('.account-submit');
    await until(()=>doc.body.dataset.role==='teacher'&&doc.querySelector('.account-logout'),'teacher sign-in');click('[data-account-close]');
    await loadFrame();await until(()=>doc.body.dataset.role==='teacher','teacher session restored after reload');
    check(visibleUpload(),'Stored account and session restore the teacher role after reload');
    const originalMarkers=doc.querySelectorAll('.globe-marker').length;
    await openUpload();
    const status=(await api('agent/status')).payload;
    check(status.publishing===true&&status.analysis===false,'Isolated server allows manual publication and reports no configured AI key');
    check(doc.querySelector('.agent-connection').textContent.length>0&&!doc.querySelector('.agent-connection').classList.contains('ready'),'Upload dialog explains the missing model configuration');
    await addFixtures();
    check(doc.querySelector('.agent-files').textContent.includes('research-sheet.xlsx'),'ZIP materials expand into reviewable document entries');
    check(doc.querySelector('.agent-analyze').disabled,'DeepSeek analysis is disabled without a server-side key; no external analysis request is sent');
    const report=[...doc.querySelectorAll('.agent-file')].find(row=>row.querySelector('strong')?.textContent==='integration-report.docx');
    const role=report.querySelector('select');role.value='report';role.dispatchEvent(new win.Event('change',{bubbles:true}));
    fill(field('title'),projectTitle);fill(field('destination'),'临时无坐标地点');fill(field('theme'),'账号与发布验收');fill(field('researchQuestion'),'发布的资料能否在刷新后继续阅读？');fill(field('note'),'这是隔离服务的临时验收记录，不属于正式研学内容。');fill(field('fieldNotes'),'测试照片已选择为公开现场图片。');fill('[data-stage-input="0"]','先确认一段研究记录能够完整保存。');
    click('[data-edit-language="en"]');fill(field('title'),`Temporary integration ${runId}`);fill(field('destination'),'Temporary place without coordinates');click('[data-edit-language="zh"]');
    check(doc.querySelector(field('title')).value===projectTitle,'Review edits survive switching between Chinese and English');
    click('.agent-publish');await until(()=>doc.querySelector('.book-title h2')?.textContent===projectTitle&&!doc.querySelector('#project-agent').open,'real project publication',30000);
    const id=win.location.hash.slice('#journey/'.length);
    const record=(await api('projects')).payload.projects.find(project=>project.id===id);
    check(Boolean(record),'Published project is returned by the real shared project API');
    check(record.destinationCoords===null&&doc.querySelectorAll('.globe-marker').length===originalMarkers,'A project without coordinates is preserved without an invented map marker');
    check(record.title.en===`Temporary integration ${runId}`&&record.fieldPhotos.length===1&&record.model?.src&&record.finalOutcomes[0]?.src,'Edited bilingual text, field image, GLB and report are all persisted');
    check(!doc.querySelector('.book-title h2 em'),'Published text is escaped rather than treated as HTML');
    check(doc.querySelector('.reading-page').textContent.includes('先确认一段研究记录能够完整保存。'),'Published notes enter the current continuous-reading layout');
    check(doc.querySelector('.outcome-links a')?.href.endsWith(record.finalOutcomes[0].src),'Published reports have working output links in the notes panel');
    check((await fetch(new URL(`../${record.finalOutcomes[0].src}`,document.baseURI))).ok,'The public document is served by the persistent media endpoint');
    click('#tab-photos');await until(()=>doc.querySelector('#detail-photo img')?.naturalWidth>0,'published cover preview');
    check(doc.querySelector('#detail-photo img').src.endsWith(record.cover),'Published cover appears in the existing photo tab');click('#photo-next');
    await until(()=>doc.querySelector('#detail-photo img')?.naturalWidth>0,'published field photo');check(doc.querySelector('#detail-photo img').src.endsWith(record.fieldPhotos[0].src),'Published field image remains separate from the cover');
    click('#tab-models');await until(()=>doc.querySelector('#model-stage canvas'),'published GLB renderer',30000);
    check(doc.querySelector('.model-title').textContent==='integration-model.glb'&&doc.querySelector('#model-stage canvas').width>0,'The uploaded GLB renders through the current 3D tab');
    await loadFrame();await until(()=>doc.querySelector('.book-title h2')?.textContent===projectTitle&&doc.body.dataset.role==='teacher','published route and teacher session after reload');
    check(visibleUpload()&&doc.querySelector('.reading-page').textContent.includes('临时验收记录'),'Browser refresh restores published content and the teacher session');
    // A second, model-less project verifies map grouping and no inherited demonstration model.
    await openUpload();fill(field('title'),secondTitle);fill(field('destination'),'苏州');fill(field('note'),'用于验证同一地点的多个项目入口。');fill('#agent-lat','31.299');fill('#agent-lng','120.585');click('.agent-publish');
    await until(()=>doc.querySelector('.book-title h2')?.textContent===secondTitle,'second real publication',30000);
    click('#tab-models');check(doc.querySelector('.model-empty')&&!doc.querySelector('#model-stage'),'A newly published project without a model shows the empty state');
    const suzhouMarker=[...doc.querySelectorAll('.globe-marker')].find(button=>button.getAttribute('aria-label')==='苏州');suzhouMarker.click();
    await until(()=>doc.querySelector('#archive-dialog').open,'same-place project chooser');
    check(doc.querySelectorAll('#archive-dialog .archive-card').length===2&&doc.querySelector('#archive-dialog').textContent.includes(secondTitle),'Existing and new Suzhou projects are both accessible from their shared map point');
    click('[data-archive-close]');await logoutUI();
    check(!visibleUpload(),'Signing out immediately hides Upload again');
    await loadFrame();await until(()=>doc.body.dataset.role==='visitor','visitor refresh');
    check(!visibleUpload(),'Visitor refresh does not restore a teacher-only control');
    click('#journeys');await until(()=>doc.querySelector('#archive-dialog').open,'public project archive');
    const publicCard=[...doc.querySelectorAll('.archive-card')].find(button=>button.querySelector('strong')?.textContent===projectTitle);
    check(Boolean(publicCard),'Visitors can discover the coordinate-free published project after reload');publicCard.click();
    check(doc.querySelector('.book-title h2')?.textContent===projectTitle,'Visitor archive opens the persisted project in the current layout');
    check(screenshotFit(),'Integrated visitor page remains within the desktop viewport');
    completed=true;output.textContent+='\nALL INTEGRATION CHECKS PASSED';
  } catch(error) {output.className='fail';output.textContent+=`\nFAIL ${error.message}`;}
  finally {
    try {const current=(await api('auth/me')).payload;if(current.user)await api('auth/logout',{},current.csrfToken);}catch{}
    runButton.disabled=false;
    if(completed)output.textContent+='\nTest accounts/projects remain only in the isolated temporary data directory. Test session is signed out.';
  }
};
