'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Chess} from 'chess.js';
import {createPiece,disposePieceAssets} from './piece-model.mjs';
type Props={fen:string;selected:string|null;targets:string[];onSquare:(s:string)=>void;orientation:'w'|'b';lastMove?:{from:string;to:string}|null;effects:boolean;onUnavailable?:()=>void};
const pos=(s:string)=>new THREE.Vector3(s.charCodeAt(0)-100.5,.23,3.5-(+s[1]-1));
export default function Board3D(props:Props){
 const mount=useRef<HTMLDivElement>(null), latest=useRef(props), api=useRef<any>(null); latest.current=props;
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const el=mount.current;if(!el)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'})}catch{setFailed(true);latest.current.onUnavailable?.();return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#262037',.018);
  const camera=new THREE.PerspectiveCamera(37,1,.1,100);camera.position.set(0,12.8,11.2);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.25,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=11;controls.maxDistance=24;controls.minPolarAngle=.25;controls.maxPolarAngle=1.12;controls.rotateSpeed=.55;controls.enableZoom=true;
  scene.add(new THREE.HemisphereLight('#e1d8ff','#5a3854',1.5));
  const key=new THREE.DirectionalLight('#fff0cd',3);key.position.set(-4,10,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.bias=-.0006;scene.add(key);
  const rim=new THREE.DirectionalLight('#b5a5ff',2);rim.position.set(5,7,-6);scene.add(rim);
  const light=new THREE.PointLight('#ffb174',15,15);light.position.set(-5,3,-3);scene.add(light);
  const gold=new THREE.MeshStandardMaterial({color:'#b78c49',metalness:.85,roughness:.27});
  const ivory=new THREE.MeshStandardMaterial({color:'#eee3d3',metalness:.02,roughness:.65});
  const ebony=new THREE.MeshStandardMaterial({color:'#695f6a',metalness:.02,roughness:.6});
  const edge=new THREE.Mesh(new THREE.BoxGeometry(8.65,.35,8.65),gold);edge.position.y=-.05;edge.castShadow=true;edge.receiveShadow=true;scene.add(edge);
  const lower=new THREE.Mesh(new THREE.BoxGeometry(8.8,.12,8.8),new THREE.MeshStandardMaterial({color:'#30253c',metalness:.45,roughness:.3}));lower.position.y=-.28;scene.add(lower);
  const tiles:THREE.Mesh[]=[];
  const makeMarble=(dark:boolean)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;ctx.fillStyle=dark?'#51435e':'#d6c3ad';ctx.fillRect(0,0,256,256);for(let i=0;i<11;i++){ctx.beginPath();ctx.strokeStyle=dark?'rgba(210,184,175,.09)':'rgba(114,88,100,.07)';ctx.lineWidth=.4+Math.random()*2;let y=Math.random()*300;ctx.moveTo(-20,y);for(let x=0;x<280;x+=20){y+=(Math.random()-.5)*35;ctx.lineTo(x,y)}ctx.stroke()}const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex};
  const matW=new THREE.MeshStandardMaterial({map:makeMarble(false),roughness:.3,metalness:.26});const matB=new THREE.MeshStandardMaterial({map:makeMarble(true),roughness:.28,metalness:.35});
  for(let f=0;f<8;f++)for(let r=0;r<8;r++){const sq=String.fromCharCode(97+f)+(r+1);const tile=new THREE.Mesh(new THREE.BoxGeometry(.993,.1,.993),(f+r)%2?matW:matB);tile.position.copy(pos(sq));tile.position.y=.16;tile.receiveShadow=true;tile.userData.square=sq;scene.add(tile);tiles.push(tile)}
  // Coordinate lettering is part of the actual board, not a baked image.
  function label(text:string,x:number,z:number){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;ctx.font='30px Georgia';ctx.textAlign='center';ctx.fillStyle='#e6c992';ctx.fillText(text,32,43);const m=new THREE.Mesh(new THREE.PlaneGeometry(.24,.24),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.15,z);scene.add(m)}
  for(let i=0;i<8;i++){label('abcdefgh'[i],i-3.5,4.18);label(String(i+1),-4.18,3.5-i)}
  const pieces=new THREE.Group(),marks=new THREE.Group(),sparks=new THREE.Group();scene.add(pieces,marks,sparks);
  const animations:{obj:THREE.Object3D;from:THREE.Vector3;to:THREE.Vector3;start:number}[]=[];
  const departures:{obj:THREE.Object3D;start:number}[]=[];
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,y:number,x=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o}
  const model=(type:string,color:string)=>createPiece(type,color,ivory,ebony);
  const particleGeometry=new THREE.BufferGeometry();const positions=new Float32Array(95*3);for(let i=0;i<95;i++){positions[i*3]=(Math.random()-.5)*16;positions[i*3+1]=.5+Math.random()*6;positions[i*3+2]=(Math.random()-.5)*15}particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const dust=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:'#ffda90',size:.035,transparent:true,opacity:.7,depthWrite:false}));scene.add(dust);
  let prevFen='',prevOrientation='w',cameraTarget:THREE.Vector3|null=null;
  function disposeGroup(group:THREE.Group){while(group.children.length){const o=group.children[0];group.remove(o);o.traverse((n:any)=>{if(n.geometry&&!n.userData.sharedPiece)n.geometry.dispose();if(n.material&&!n.userData.sharedPiece&&!([gold,ivory,ebony].includes(n.material)))n.material.dispose()})}}
  function update(){const p=latest.current;if(p.fen!==prevFen){
   if(prevFen&&p.lastMove&&p.effects){const old=new Chess(prevFen), before=old.get(p.lastMove.from as any), victim=old.get(p.lastMove.to as any);let captured=victim? p.lastMove.to : null;
    if(before?.type==='p'&&p.lastMove.from[0]!==p.lastMove.to[0]&&!victim)captured=p.lastMove.to[0]+p.lastMove.from[1];
    if(captured){const removed=old.get(captured as any);if(removed){const ghost=model(removed.type,removed.color);ghost.position.copy(pos(captured));ghost.traverse((n:any)=>{if(n.isMesh)n.raycast=()=>{}});scene.add(ghost);departures.push({obj:ghost,start:performance.now()})}}}
   disposeGroup(pieces);animations.splice(0);const chess=new Chess(p.fen);chess.board().flat().filter(Boolean).forEach((piece:any)=>{const obj=model(piece.type,piece.color);obj.position.copy(pos(piece.square));obj.traverse((child:any)=>child.userData.square=piece.square);pieces.add(obj);if(prevFen&&p.lastMove?.to===piece.square&&p.effects){const to=obj.position.clone(),from=pos(p.lastMove!.from);obj.position.copy(from);animations.push({obj,from,to,start:performance.now()})}});prevFen=p.fen}
   disposeGroup(marks);if(p.lastMove)for(const s of [p.lastMove.from,p.lastMove.to]){const m=mesh(new THREE.PlaneGeometry(.94,.94),new THREE.MeshBasicMaterial({color:'#e8bd76',transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}),0);m.rotation.x=-Math.PI/2;m.position.copy(pos(s));m.position.y=.217;marks.add(m)}
   if(p.selected){const m=mesh(new THREE.TorusGeometry(.4,.025,10,48),new THREE.MeshBasicMaterial({color:'#ffe1a1'}),0);m.rotation.x=-Math.PI/2;m.position.copy(pos(p.selected));m.position.y=.235;marks.add(m)}
   for(const s of p.targets){const m=mesh(new THREE.CylinderGeometry(.105,.105,.018,24),new THREE.MeshBasicMaterial({color:'#f6d9a4',transparent:true,opacity:.85}),0);m.position.copy(pos(s));m.position.y=.234;marks.add(m)}
   if(p.orientation!==prevOrientation){cameraTarget=new THREE.Vector3(0,12.8,p.orientation==='w'?11.2:-11.2);prevOrientation=p.orientation}dust.visible=false;
  }
  api.current={update};update();
  const resize=()=>{const {width,height}=el.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()};const ro=new ResizeObserver(resize);ro.observe(el);resize();
  const raycaster=new THREE.Raycaster();let down={x:0,y:0};
  const pointerdown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY}};
  const click=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=raycaster.intersectObjects([...tiles,...pieces.children],true).find(x=>x.object.userData.square);if(hit)latest.current.onSquare(hit.object.userData.square)};
  renderer.domElement.addEventListener('pointerdown',pointerdown);renderer.domElement.addEventListener('pointerup',click);
  let frame=0,previous=performance.now();const animate=()=>{frame=requestAnimationFrame(animate);const now=performance.now(),dt=Math.min((now-previous)/1000,.05);previous=now;for(let i=animations.length-1;i>=0;i--){const a=animations[i],t=Math.min((now-a.start)/700,1),ease=t*t*(3-2*t);a.obj.position.lerpVectors(a.from,a.to,ease);a.obj.position.y+=Math.sin(t*Math.PI)*.10;const upper=a.obj.userData.upper as THREE.Group,feet=a.obj.userData.feet as THREE.Group|undefined;if(upper)upper.rotation.z=Math.sin(t*Math.PI*4)*.07*Math.sin(Math.PI*t);if(feet){feet.visible=true;feet.children.forEach((foot,j)=>foot.position.z=.235+Math.sin(t*Math.PI*4+j*Math.PI)*.075)}if(t===1){if(upper)upper.rotation.z=0;if(feet)feet.visible=false;animations.splice(i,1)}}for(let i=departures.length-1;i>=0;i--){const d=departures[i],t=Math.min((now-d.start)/450,1);d.obj.scale.setScalar(Math.max(.001,1-t));if(t===1){scene.remove(d.obj);d.obj.traverse((n:any)=>{if(!n.userData.sharedPiece)n.geometry?.dispose()});departures.splice(i,1)}}
  for(const obj of pieces.children){const u=obj.userData.upper as THREE.Group;if(u&&!animations.some(a=>a.obj===obj))u.rotation.z=latest.current.effects?Math.sin(now*.0011+obj.position.x+obj.position.z)*.006:0}
  for(const sp of [...sparks.children]){const t=(now-sp.userData.birth)/1000;if(t>1){sparks.remove(sp);(sp as THREE.Mesh).geometry.dispose();((sp as THREE.Mesh).material as THREE.Material).dispose()}else{sp.position.addScaledVector(sp.userData.v,dt);sp.userData.v.y-=dt*2;sp.scale.setScalar(1-t)}}dust.rotation.y+=dt*.015;dust.position.y=Math.sin(now*.0003)*.15;if(cameraTarget){camera.position.lerp(cameraTarget,.08);if(camera.position.distanceTo(cameraTarget)<.02)cameraTarget=null}controls.update();renderer.render(scene,camera)};animate();
  return()=>{cancelAnimationFrame(frame);ro.disconnect();controls.dispose();renderer.dispose();scene.traverse((o:any)=>{if(!o.userData.sharedPiece)o.geometry?.dispose()});disposePieceAssets();el.removeChild(renderer.domElement);api.current=null};
 },[]);
 useEffect(()=>api.current?.update(),[props.fen,props.selected,props.targets,props.orientation,props.effects,props.lastMove]);
 return <div ref={mount} className="board-canvas" role="img" aria-label="Интерактивная трёхмерная шахматная доска. Нажмите на фигуру и клетку хода.">{failed&&<div className="webgl-error">3D недоступно в этом браузере.<br/>Переключитесь на 2D внизу доски.</div>}</div>
}
