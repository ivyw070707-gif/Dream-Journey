import {getProjects, getStages} from './data.js';
import {createAccount} from './account.js';
import {createProjectAgent} from './project-agent.js';
import {loadPublishedProjects} from './project-api.js';
import {localizeProject} from './project-schema.js';
import {journeyContent} from './journey-content.js';
import {impactData} from './impact-data.js';
import {projectModels} from './project-models.js';
import {initialLocale, translate} from './i18n.js';
let storage; try { storage = localStorage; } catch {}
let language = initialLocale(storage, navigator.language), publishedProjects=[], projects = getProjects(language), mapEntries=[];
const t=key=>translate(key,language);
const app = document.querySelector('#app'), dialog = document.querySelector('#viewer');
const say = (zh, en) => language === 'zh' ? zh : en;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let photoPage = 0;
let active = -1, tab = 'text', globe, modelCleanup, modelRun = 0, shellRun = 0, slide = 0, savedView;

const localized=value=>typeof value==='string'?value:value?.[language]||value?.zh||value?.en||'';
function rebuildProjects(){projects=[...getProjects(language),...publishedProjects.map(p=>localizeProject(p,language))];}
function content(i) {
 const p=projects[i];if(journeyContent[p.id])return journeyContent[p.id];
 return {theme:p.theme,question:p.researchQuestion,summary:p.note,steps:(p.researchNotes||[]).map((text,index)=>({title:getStages(language)[index],text})).filter(step=>step.text),photos:p.fieldPhotos||[],fieldNotes:p.fieldNotes,questions:p.unansweredQuestions||[],facts:[[say('参与者','Participants'),p.studentName],[say('出发地','From'),p.origin],[say('交通','Travel'),p.transport],[say('年份','Year'),p.year]].filter(([,value])=>value),sourceNote:say('由项目提交者整理并发布。','Submitted and published by the project contributor.'),outcomes:(p.finalOutcomes||[]).filter(Boolean)};
}
function photos(i) { return content(i).photos || []; }
function allPhotos() { return projects.flatMap((p, i) => photos(i).map(photo => ({...photo,i}))); }
function rebuildMap(){
 mapEntries=[];
 projects.forEach((project,index)=>{if(!project.destinationCoords)return;const {lat,lng}=project.destinationCoords;let entry=mapEntries.find(e=>e.project.destination===project.destination&&Math.abs(e.project.destinationCoords.lat-lat)<.1&&Math.abs(e.project.destinationCoords.lng-lng)<.1);if(entry)entry.indexes.push(index);else mapEntries.push({project,indexes:[index]});});
}
function selectMapProject(index){const mapIndex=mapEntries.findIndex(e=>e.indexes.includes(index));if(mapIndex>=0)globe?.select(mapIndex);}
function openMapEntry(index){const entry=mapEntries[index];if(entry.indexes.length===1)openProject(entry.indexes[0]);else showArchive(entry.indexes,entry.project.destination);}
function refreshAccountControls(){
 const user=account.getUser();document.body.dataset.role=user?.role||'visitor';
 document.querySelector('#account-button').textContent=user?`${t(`role_${user.role}`)} · ${user.name}`:say('登录','Sign in');
 document.querySelector('#upload').hidden=user?.role!=='teacher';
}
function updateHeader() {
 document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
 document.querySelector('#explore').textContent = say('旅程地图','Journey map');
 document.querySelector('#journeys').textContent = say('旅行手记','Field notes');
 document.querySelector('#impact').textContent = say('关于去远方','About');
 document.querySelector('#upload').textContent = say('＋ 上传','＋ Upload');
 refreshAccountControls();
 document.querySelector('#language').textContent = language === 'zh' ? 'EN' : '中';
}
function shell() {
 savedView = globe?.getView() || savedView; globe?.dispose(); globe=null; stopModel();
 const run=++shellRun;rebuildMap();
 app.innerHTML = `<section class="journey-desk"><div class="map-column"><div class="globe" role="group" aria-label="${say('研学地球','Journey globe')}"><canvas tabindex="0" aria-label="${say('拖动旋转，滚轮缩放，方向键移动','Drag to rotate, scroll to zoom, arrow keys to move')}"></canvas><div class="globe-markers">${mapEntries.map(({project:p},i)=>`<button class="globe-marker" data-i="${i}" aria-label="${esc(p.destination)}"><span class="marker-dot"></span><span class="marker-label">${esc(p.destination)}</span></button>`).join('')}</div><span class="globe-status" role="status">${say('正在展开地图…','Loading globe…')}</span><div class="globe-controls"><button data-globe="in" aria-label="放大">+</button><button data-globe="out" aria-label="缩小">−</button><button data-globe="reset" aria-label="复位">⌂</button></div></div></div><div class="right-column" id="right-column"></div></section>`;
 const host = document.querySelector('.globe');
 const fallback = () => {if(run!==shellRun)return;host.classList.add('globe-fallback'); host.dataset.ready='fallback'; host.querySelector('.globe-status').hidden=false;host.querySelector('.globe-status').textContent=say('地图暂不可用','Map unavailable');host.querySelectorAll('.globe-marker').forEach((button,i)=>{button.hidden=false;button.style.left='';button.style.top='';button.onclick=()=>openMapEntry(i);});};
 import('./globe.js').then(async ({createGlobe})=>{if(run!==shellRun)return;try {const instance=await createGlobe(host,{projects:mapEntries.map(e=>e.project),active:mapEntries.findIndex(e=>e.indexes.includes(active)),view:savedView,onSelect:openMapEntry,onError:fallback});if(run!==shellRun){instance?.dispose();return;}globe=instance;}catch{fallback();}}).catch(fallback);
 updateHeader(); renderRight();
}
function stopModel() { modelRun++; modelCleanup?.(); modelCleanup=null; }
function renderRight() {
 stopModel();
 document.querySelector('#explore').classList.toggle('nav-active',active<0);
 document.querySelector('#journeys').classList.toggle('nav-active',active>=0);
 if(active<0) renderHome(); else renderProject();
}
function renderHome() {
 const list=allPhotos(), photo=list[slide % Math.max(1,list.length)] || {src:projects[0].cover,caption:projects[0].title};
 document.querySelector('#right-column').innerHTML=`<section class="welcome"><div class="impact-stats">${impactData.stats.map(s=>`<div><strong>${esc(s.value)}</strong><span>${esc(language==='en'?s.labelEn||s.label:s.label)}</span></div>`).join('')}</div><p class="source-note"><a href="${esc(impactData.sourceUrl)}" target="_blank" rel="noopener">${esc(language==='zh'?impactData.asOf:impactData.asOfEn)} · ${say('官方数据 ↗','Source ↗')}</a></p></section><section class="photo-diary" aria-label="${say('自动播放的研学图片','Study photos slideshow')}"><img id="hero-photo" src="${esc(photo.src)}" alt="${esc(photo.caption)}"></section>`;
}
function changeSlide() {
 const list=allPhotos();if(!list.length)return;slide=(slide+1)%list.length;
 const image=document.querySelector('#hero-photo');if(image){image.src=list[slide].src;image.alt=list[slide].caption;}
}
function openProject(i, push=true) {
 if(!projects[i])return;active=i;tab='text';photoPage=0;selectMapProject(i);if(push) history.pushState({},'',`#journey/${projects[i].id}`);renderRight();

}
function renderProject() {
 const p=projects[active], c=content(active);
 document.querySelector('#right-column').innerHTML=`<article class="project-book"><div class="book-heading"><button id="back-home">← ${say('所有旅程','All journeys')}</button><span>${String(active+1).padStart(2,'0')} / ${esc(p.destination)}</span></div><div class="book-title"><h2>${esc(p.title)}</h2><p>${esc(c.theme || say('从一个地方，发现一种生活。','One place. A new way of seeing.'))}</p></div><div class="book-layout"><div class="book-tabs" role="tablist" aria-label="项目内容">${[['text','文字','Notes','≋'],['photos','图片','Photos','▧'],['models','3D作品','3D works','◇']].map(([id,zh,en,icon])=>`<button id="tab-${id}" role="tab" aria-controls="tab-content" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}" data-tab="${id}"><span>${icon}</span>${say(zh,en)}</button>`).join('')}</div><section id="tab-content" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="0"></section></div><div class="book-footer"><button id="next-project">${say('下一段旅程','Next journey')} →</button></div></article>`;
 document.querySelector('#back-home').onclick=home;
 document.querySelector('#next-project').onclick=()=>openProject((active+1)%projects.length);
 const tabs=[...document.querySelectorAll('[data-tab]')];
 tabs.forEach((b,i)=>{b.onclick=()=>{tab=b.dataset.tab;renderRight();document.querySelector(`#tab-${tab}`).focus();};b.onkeydown=e=>{if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){e.preventDefault();tabs[(i+(['ArrowDown','ArrowRight'].includes(e.key)?1:2))%3].click();}};});
 renderTab();
}
function renderTab() {
 const host=document.querySelector('#tab-content'),c=content(active),p=projects[active];
 if(tab==='text') {
 host.innerHTML=`<article class="reading-page" tabindex="0" aria-label="${say('研学文字记录','Study notes')}"><span class="page-label">${say('旅行档案','FIELD JOURNAL')} / ${esc(p.destination)}</span>${c.isExample?`<span class="example-label">${say('示例研学文案','Illustrative study narrative')}</span>`:''}<div class="reading-body">${c.facts?.length?`<dl class="project-facts">${c.facts.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`:''}<h3>${esc(c.question || '')}</h3><p class="summary">${esc(c.summary || '')}</p>${(c.steps||[]).map((step,i)=>`<section class="research-step"><span class="step-number">${String(i+1).padStart(2,'0')}</span><div><h4>${esc(step.title)}</h4><p>${esc(step.text)}</p></div></section>`).join('')}${c.fieldNotes?`<section class="research-step"><div><h4>${say('现场记录','Field notes')}</h4><p>${esc(c.fieldNotes)}</p></div></section>`:''}${c.questions?.length?`<section class="research-step"><div><h4>${say('继续追问','Further questions')}</h4>${c.questions.map(q=>`<p>${esc(q)}</p>`).join('')}</div></section>`:''}${c.outcomes?.length?`<section class="outcome-links"><h4>${say('项目成果','Project outputs')}</h4>${c.outcomes.map(o=>`<a href="${esc(o.src)}" target="_blank" rel="noopener">${esc(localized(o.caption)||o.name||say('查看成果','View output'))} ↗</a>`).join('')}</section>`:''}<p class="source-footnote">${esc(c.sourceNote || '')}</p></div></article>`;
 } else if(tab==='photos') {
 const list=[...(p.cover?[{src:p.cover,caption:say('研学档案封面','Journey cover')}]:[]),...photos(active)];if(!list.length){host.innerHTML=`<div class="content-empty">${say('暂无图片','No photos yet')}</div>`;return;}photoPage=Math.min(photoPage,list.length-1);const photo=list[photoPage];
 host.innerHTML=`<div class="photo-page"><button class="single-photo" id="detail-photo"><img src="${esc(photo.src)}" alt="${esc(photo.caption)}"><span>${esc(photo.caption)}</span></button><div class="page-turner"><button id="photo-prev" ${photoPage===0?'disabled':''} aria-label="上一张">←</button><span>${photoPage+1} / ${list.length} ${say('张 · 点击放大','photos · tap to enlarge')}</span><button id="photo-next" ${photoPage===list.length-1?'disabled':''} aria-label="下一张">→</button></div></div>`;
 document.querySelector('#detail-photo').onclick=()=>showDialog(`<figure class="lightbox"><img src="${esc(photo.src)}" alt="${esc(photo.caption)}"><figcaption>${esc(photo.caption)}</figcaption></figure>`);
 document.querySelector('#photo-prev').onclick=()=>{photoPage--;renderTab();};document.querySelector('#photo-next').onclick=()=>{photoPage++;renderTab();};
 } else {
 const model=p.model?.src?{...p.model,en:p.model.name,name:localized(p.model.caption)||p.model.name||say('3D作品','3D artwork')}:projectModels[p.id];
 if(!model){host.innerHTML=`<div class="model-empty" role="status"><span aria-hidden="true">◇</span><p>${say('暂无3D作品','No 3D artwork yet')}</p></div>`;return;}
 host.innerHTML=`<div class="model-page"><h3 class="model-title">${esc(language==='zh'?model.name:model.en)}</h3><div class="model-stage" id="model-stage"></div><div class="model-tools"><span>${say('拖动旋转 · 滚轮缩放','Drag to rotate · Scroll to zoom')}</span><button id="reset-model">${say('恢复视角','Reset view')} ↺</button></div></div>`;
 loadModel(model);

 }
}
async function loadModel(model) {
 stopModel();const run=modelRun,host=document.querySelector('#model-stage');
 host.innerHTML=`${model.poster?`<img class="model-poster" src="${esc(model.poster)}" alt="${esc(model.name)}">`:''}<span class="model-status" role="status">${say('正在打开3D作品…','Opening the 3D model…')}</span>`;
 try {const {createModelViewer}=await import('./model-viewer.js');if(run!==modelRun)return;const api=await createModelViewer(host,model.src,()=>run===modelRun);if(run!==modelRun){api?.dispose();return;}modelCleanup=()=>api.dispose();document.querySelector('#reset-model').onclick=api.reset;}catch{if(run===modelRun)host.querySelector('.model-status').textContent=say('3D加载暂不可用，可先查看作品预览。','3D is unavailable. The artwork preview is shown.');}
}
function home() {active=-1;history.pushState({},'','#explore');renderRight();}
function showDialog(html) {document.querySelector('#viewer-content').innerHTML=html;if(!dialog.open)dialog.showModal();}
function showAbout(){showDialog(`<div class="about-page"><span class="eyebrow">DREAM JOURNEY</span><h2>${say('让孩子自己问，<br>自己找，自己发现。','A question of their own.<br>A world to discover.')}</h2><p>${say('“去远方”是真爱梦想的研学旅行项目。孩子们从自己的问题出发，在真实的世界中观察、合作、寻找答案。这里把散落的旅行手记、现场照片与创作放在一起，让下一位出发的人也能找到灵感。','Dream Journey is Adream’s field-study travel program. This atlas brings together questions, field notes, photographs and creative work, inspiring the next young explorer.')}</p><p>${esc(language==='zh'?impactData.note:impactData.noteEn)}</p><a href="${esc(impactData.sourceUrl)}" target="_blank" rel="noopener">${esc(impactData.sourceTitle)} ↗</a></div>`);}
document.querySelector('.close').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
document.querySelector('#home').onclick=home;document.querySelector('#explore').onclick=home;document.querySelector('#journeys').onclick=()=>showArchive();document.querySelector('#impact').onclick=showAbout;
document.querySelector('#language').onclick=()=>{language=language==='zh'?'en':'zh';try{storage?.setItem('dream-journey-language',language);}catch{}rebuildProjects();shell();account.refreshLocale();projectAgent.refreshLocale();if(archiveDialog.open)showArchive();};
function readHash(){const i=projects.findIndex(p=>location.hash===`#journey/${p.id}`);active=i;tab='text';photoPage=0;if(globe&&i>=0)selectMapProject(i);if(document.querySelector('#right-column'))renderRight();}
window.addEventListener('popstate',readHash);window.addEventListener('hashchange',readHash);
window.addEventListener('pagehide',()=>{stopModel();globe?.dispose();});
setInterval(()=>{if(active<0&&!document.querySelector('dialog[open]')&&!document.hidden)changeSlide();},5000);
const archiveDialog=document.querySelector('#archive-dialog');
function showArchive(indexes=projects.map((_,i)=>i),destination=''){
 archiveDialog.innerHTML=`<div class="archive-heading"><h2 id="archive-title">${esc(destination||say('所有旅程','All journeys'))}</h2><button data-archive-close aria-label="${say('关闭','Close')}">×</button></div><div class="archive-grid">${indexes.map(i=>{const p=projects[i];return `<button class="archive-card" data-project="${i}">${p.cover?`<img src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy">`:`<span class="archive-placeholder" aria-hidden="true">◇</span>`}<strong>${esc(p.title)}</strong><small>${esc(p.destination)}</small></button>`;}).join('')}</div>`;
 archiveDialog.querySelector('[data-archive-close]').onclick=()=>archiveDialog.close();archiveDialog.querySelectorAll('[data-project]').forEach(b=>b.onclick=()=>{archiveDialog.close();openProject(Number(b.dataset.project));});if(!archiveDialog.open)archiveDialog.showModal();
}
const projectAgent=createProjectAgent({getLanguage:()=>language,t,onPublished:project=>{
 publishedProjects=[...publishedProjects.filter(p=>p.id!==project.id),project];rebuildProjects();active=projects.findIndex(p=>p.id===project.id);tab='text';photoPage=0;history.pushState({},'',`#journey/${project.id}`);shell();
}});
let lastAccountId;
const account=createAccount({t,onChange:user=>{if(lastAccountId&&lastAccountId!==user?.id)projectAgent.clear();lastAccountId=user?.id;refreshAccountControls();}});
document.querySelector('#account-button').onclick=()=>account.open();
document.querySelector('#upload').onclick=()=>{if(account.getUser()?.role==='teacher')projectAgent.open();};
readHash();shell();account.refresh();
loadPublishedProjects().then(records=>{
 if(!records.length&&!publishedProjects.length)return;
 publishedProjects=[...new Map([...records,...publishedProjects].map(p=>[p.id,p])).values()];rebuildProjects();readHash();shell();
}).catch(()=>{const status=document.querySelector('#project-service-status');status.textContent=say('暂时无法加载新发布的项目，请刷新重试。','Published projects are unavailable. Please refresh to retry.');status.hidden=false;});
