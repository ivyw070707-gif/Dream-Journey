import * as THREE from '../../vendor/three/three.module.min.js';
import {latLngPosition} from './globe-math.js';

const OVERVIEW = {lat:35,lng:104};
const MIN_DISTANCE = 1.28, MAX_DISTANCE = 8;
let landPromise;
function loadLand() {
  return landPromise ??= fetch(new URL('../../assets/maps/land.geojson',import.meta.url))
    .then(response=>{if(!response.ok)throw new Error('Map data unavailable');return response.json();})
    .catch(error=>{landPromise=null;throw error;});
}

// The original quiet green atlas: one land palette, simple country outlines,
// and a light latitude/longitude grid. No province colours or place-name layer.
function greenTexture(land, renderer) {
  const canvas=document.createElement('canvas');canvas.width=4096;canvas.height=2048;
  const ctx=canvas.getContext('2d');
  const width=canvas.width,height=canvas.height;
  ctx.fillStyle='#e2e7df';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#c4cfbe';ctx.lineWidth=1.2;
  for(let x=0;x<=width;x+=width/24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
  for(let y=0;y<=height;y+=height/12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
  for(const feature of land.features){
    ctx.fillStyle=['CHN','TWN'].includes(feature.properties.code)?'#a5b291':'#c9ceba';
    ctx.strokeStyle='#8f9f83';ctx.lineWidth=1.5;ctx.lineJoin='round';
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    for(const polygon of polygons){
      ctx.beginPath();
      for(const ring of polygon){
        ring.forEach(([lng,lat],i)=>{const x=(lng+180)/360*width,y=(90-lat)/180*height;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
        ctx.closePath();
      }
      ctx.fill('evenodd');ctx.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return texture;
}

/** A simplified green globe with only the journey's own markers and names. */
export function createGlobe(host,{projects,active=-1,view:savedView,onSelect,onError}) {
  const canvas=host.querySelector(':scope > canvas'),status=host.querySelector('.globe-status');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.04,100);
  const geometry=new THREE.SphereGeometry(1,128,80);
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,metalness:0});
  scene.add(new THREE.Mesh(geometry,material),new THREE.AmbientLight(0xffffff,1.75));
  const sunlight=new THREE.DirectionalLight(0xfff9ea,1.5);scene.add(sunlight);
  const vector=p=>new THREE.Vector3(...latLngPosition(p));
  const locations=projects.map(p=>vector(p.destinationCoords).multiplyScalar(1.004));
  const buttons=[...host.querySelectorAll('.globe-marker')], offsets=[[15,13],[15,-23],[-57,-26],[-57,12]];
  const events=new AbortController(),pointers=new Map();
  let disposed=false,failed=false,frame=0,isOverview=savedView?.overview??!savedView,previousPinch;
  const normalizeLongitude=lng=>((lng+180)%360+360)%360-180;
  const clampView=v=>({lat:Math.max(-85,Math.min(85,v.lat)),lng:normalizeLongitude(v.lng),distance:Math.max(MIN_DISTANCE,Math.min(MAX_DISTANCE,v.distance))});
  let view=clampView({lat:savedView?.lat??OVERVIEW.lat,lng:savedView?.lng??OVERVIEW.lng,distance:savedView?.distance??3.05});
  canvas.tabIndex=0;canvas.setAttribute('aria-label','拖动旋转地球，滚轮缩放，方向键移动，Home复位');
  function fitDistance(){
    const aspect=Math.max(.1,host.clientWidth/Math.max(1,host.clientHeight));
    const halfY=THREE.MathUtils.degToRad(camera.fov/2);
    const halfShort=Math.atan(Math.tan(halfY)*Math.min(1,aspect));
    return 1/Math.sin(Math.atan(Math.tan(halfShort)*.92));
  }
  function render(){
    frame=0;if(disposed||failed)return;
    const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    camera.position.copy(vector(view).multiplyScalar(view.distance));camera.lookAt(0,0,0);camera.updateMatrixWorld();
    sunlight.position.copy(camera.position).add(new THREE.Vector3(-2,3,1));
    renderer.render(scene,camera);
    locations.forEach((position,i)=>{
      const projected=position.clone().project(camera),button=buttons[i];if(!button)return;
      const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
      button.hidden=!(position.dot(camera.position.clone().sub(position))>0&&x>20&&x<width-20&&y>20&&y<height-20);
      button.style.left=`${x}px`;button.style.top=`${y}px`;
      button.style.setProperty('--label-x',`${(offsets[i]||[15,12])[0]}px`);
      button.style.setProperty('--label-y',`${(offsets[i]||[15,12])[1]}px`);
      button.classList.toggle('active',i===active);button.setAttribute('aria-pressed',String(i===active));
    });
    host.dataset.latitude=view.lat.toFixed(3);host.dataset.longitude=view.lng.toFixed(3);host.dataset.distance=view.distance.toFixed(5);
    host.querySelector('[data-globe="in"]').disabled=view.distance<=MIN_DISTANCE+.00001;
    host.querySelector('[data-globe="out"]').disabled=view.distance>=MAX_DISTANCE-.00001;
  }
  function requestRender(){if(!disposed&&!failed&&!frame)frame=requestAnimationFrame(render);}
  function change(next){isOverview=false;view=clampView({...view,...next});requestRender();}
  function overview(){view=clampView({...OVERVIEW,distance:fitDistance()});isOverview=true;requestRender();}
  function zoom(factor){change({distance:1+(view.distance-1)*factor});}
  function select(index){
    active=index;
    const button=buttons[index],project=projects[index];
    if(project&&button?.hidden)change({lat:project.destinationCoords.lat,lng:project.destinationCoords.lng});
    requestRender();
  }
  const input={signal:events.signal};
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});previousPinch=null;host.classList.add('dragging');
  },input);
  canvas.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    const old=pointers.get(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){
      const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(previousPinch&&distance>0)zoom(previousPinch/distance);previousPinch=distance;
    }else if(pointers.size===1){
      const sensitivity=.13*Math.min(1.6,view.distance/3.05);
      change({lng:view.lng-(event.clientX-old.x)*sensitivity,lat:view.lat+(event.clientY-old.y)*sensitivity});
    }
  },input);
  function release(event){pointers.delete(event.pointerId);previousPinch=null;if(!pointers.size)host.classList.remove('dragging');}
  canvas.addEventListener('pointerup',release,input);canvas.addEventListener('pointercancel',release,input);canvas.addEventListener('lostpointercapture',release,input);
  canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(Math.max(-100,Math.min(100,event.deltaY))*.0015));},{...input,passive:false});
  canvas.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    const moves={ArrowLeft:{lng:view.lng-3},ArrowRight:{lng:view.lng+3},ArrowUp:{lat:view.lat+3},ArrowDown:{lat:view.lat-3}};
    if(moves[event.key]){event.preventDefault();change(moves[event.key]);}
    else if(['+','=','-','_','Home'].includes(event.key)){event.preventDefault();if(event.key==='Home')overview();else zoom(['+','='].includes(event.key)?.75:1.333333);}
  },input);
  host.querySelectorAll('[data-globe]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.globe==='reset')overview();else zoom(button.dataset.globe==='in'?.75:1.333333);},input));
  buttons.forEach((button,i)=>button.addEventListener('click',()=>onSelect(i),input));
  function fail(){if(disposed||failed)return;failed=true;cancelAnimationFrame(frame);onError();}
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail();},input);
  const observer=new ResizeObserver(()=>{if(isOverview)view=clampView({...view,distance:fitDistance()});requestRender();});observer.observe(host);
  if(isOverview)view=clampView({...view,distance:fitDistance()});
  requestRender();
  loadLand().then(land=>{
    if(disposed||failed)return;
    material.map=greenTexture(land,renderer);material.needsUpdate=true;host.dataset.ready='true';status.hidden=true;requestRender();
  }).catch(fail);
  return {select,getView:()=>({...view,overview:isOverview}),dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);events.abort();observer.disconnect();geometry.dispose();material.map?.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
