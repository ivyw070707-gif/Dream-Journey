import * as THREE from '../../vendor/three/three.module.min.js';
import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from '../../vendor/three/addons/controls/OrbitControls.js';
export async function createModelViewer(host, url, isCurrent) {
 const asset = await new GLTFLoader().loadAsync(url);
 const root = asset.scene;
 const releaseRoot=()=>root.traverse(o=>{o.geometry?.dispose();const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];mats.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)v.dispose();});m.dispose();});});
 if(!isCurrent()){releaseRoot();return null;}
 const scene=new THREE.Scene();scene.background=new THREE.Color('#edf2e7');
 const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const scale=2.7/Math.max(size.x,size.y,size.z);root.position.sub(center);const group=new THREE.Group();group.add(root);group.scale.setScalar(scale);scene.add(group);
 scene.add(new THREE.HemisphereLight(0xfffaf0,0x9faca6,2.7));
 const light=new THREE.DirectionalLight(0xfff4de,3.4);light.position.set(4,6,5);scene.add(light);
 const fill=new THREE.DirectionalLight(0xddeaff,1.4);fill.position.set(-4,2,-2);scene.add(fill);
 const camera=new THREE.PerspectiveCamera(38,1,.01,100);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 renderer.domElement.setAttribute('aria-label','可旋转缩放的3D作品');renderer.domElement.tabIndex=0;
 host.replaceChildren(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=9;controls.enablePan=false;
 function reset(){camera.position.set(3.5,2.5,4.3);controls.target.set(0,0,0);controls.update();}reset();
 const observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(host);
 let frame,disposed=false;
 function animate(){if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate);}animate();
 const onKey=e=>{if(e.key==='Home'){e.preventDefault();reset();}if(e.key==='+'||e.key==='-'){e.preventDefault();camera.position.multiplyScalar(e.key==='+'?.9:1.1);camera.position.clampLength(2,9);controls.update();}};
 renderer.domElement.addEventListener('keydown',onKey);
 return {reset,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();releaseRoot();renderer.dispose();renderer.forceContextLoss();renderer.domElement.removeEventListener('keydown',onKey);}};
}
