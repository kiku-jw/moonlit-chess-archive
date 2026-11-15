import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Reuse one geometry per kind and side rather than rebuilding 32 figures every move.
const pieceAssets=new Map();
export function disposePieceAssets(){
  for(const asset of pieceAssets.values()) for(const part of asset){part.geometry.dispose();if(part.ownedMaterial)part.material.dispose()}
  pieceAssets.clear();
}
// Ceramic characters share one visual language, with distinctive crowns and silhouettes.
export function createPiece(type, color, ivory, ebony) {
  const root = new THREE.Group();
  const upper = new THREE.Group(); root.add(upper); root.userData.upper = upper;
  const body = color === 'w' ? ivory : ebony;
  const key=body.uuid+':'+type;
  const finish=()=>{
    if(color==='w') upper.rotation.y=Math.PI;
    if(type!=='n') {
      const feet=new THREE.Group(); feet.visible=false;
      for(const x of [-.10,.10]) {const foot=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),body);foot.scale.set(.055,.035,.09);foot.position.set(x,.055,.235);feet.add(foot)}
      root.add(feet); root.userData.feet=feet;
    }
    return root;
  };
  const previous=pieceAssets.get(key);
  if(previous){for(const part of previous){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.sharedPiece=true;upper.add(mesh)}return finish()}
  const shade = new THREE.MeshStandardMaterial({color: color === 'w' ? '#c5b9ab' : '#8a7e87', roughness: .78});
  const add = (geometry, x, y, z, material = body) => {
    const part = new THREE.Mesh(geometry, material); part.position.set(x,y,z); part.castShadow = true; part.receiveShadow = true; upper.add(part); return part;
  };
  const oval = (x,y,z,rx,ry,rz, material=body) => {const p=add(new THREE.SphereGeometry(1,24,16),x,y,z,material);p.scale.set(rx,ry,rz);return p};
  const line = (points,r=.012,material=body) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,8,false),0,0,0,material);
  const h={p:.77,r:.93,n:.95,b:1.0,q:1.04,k:1.12}[type] || .9;
  const width=type==='k'?1.08:type==='p'?.88:1;
  const profile=[[.28,0],[.31,.025],[.30,.09],[.27,.24],[.23,.42],[.18,.57],[.11,.66],[.055,.68]];
  const robe=add(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r*width,y*h)),32),0,.015,0);
  // Visible sculpted overlapping cloak edge on front and back.
  line([[-.22*width,.09*h,.14],[-.11*width,.27*h,.23],[.04*width,.45*h,.19],[.14*width,.57*h,.10]],.012);
  line([[.22*width,.10*h,-.14],[.1*width,.30*h,-.22],[-.06*width,.46*h,-.17]],.009);
  if (type==='n') {
    // Horse viewed in profile: long head, tapering muzzle, raised ears and swept mane.
    const neck=oval(-.02,.70,.0,.19,.35,.155); neck.rotation.z=-.24;
    const jaw=oval(.09,.91,.0,.17,.22,.14); jaw.rotation.z=.52;
    const muzzle=oval(.245,.84,.0,.155,.085,.105);muzzle.rotation.z=-.18;
    oval(.345,.85,.077,.018,.016,.012,shade); oval(.345,.85,-.077,.018,.016,.012,shade);
    for(const z of [-.07,.07]) {const ear=add(new THREE.ConeGeometry(.055,.20,18),-.005,1.16,z);ear.rotation.z=.18;}
    const mane=oval(-.145,.90,0,.08,.28,.145);mane.rotation.z=-.24;
    for(const z of [-.13,.13]) {const eye=oval(.10,.97,z,.028,.01,.008,shade);eye.rotation.z=-.2;}
  } else {
    const y=.68*h+.14;
    // Framing hair, neck, and an elongated human face instead of a featureless ball.
    oval(0,y-.07,-.045,.16,.205,.12);
    oval(0,y-.19,0,.065,.09,.065);
    oval(0,y,.055,.125,.157,.095);
    oval(-.105,y-.01,.006,.05,.145,.055); oval(.105,y-.01,.006,.05,.145,.055);
    const hair=oval(0,y+.10,.006,.135,.075,.105);hair.rotation.z=-.13;
    for(const x of [-.048,.048]){const eye=oval(x,y+.005,.145,.025,.005,.005,shade);eye.rotation.z=x<0?-.1:.1;}
    oval(0,y-.035,.151,.014,.03,.013);
    const mouth=oval(0,y-.074,.143,.022,.004,.004,shade);mouth.rotation.z=-.04;
    // Collar folds give human shoulders and a cloak-like neckline.
    line([[-.17,.55*h,.10],[-.08,.60*h,.16],[0,.57*h,.19],[.12,.62*h,.12]],.012);
    if(type==='r') {
      add(new THREE.CylinderGeometry(.19,.175,.105,28),0,y+.20,0);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;add(new THREE.BoxGeometry(.08,.105,.075),Math.cos(a)*.15,y+.30,Math.sin(a)*.15)}
    } else if(type==='b') {
      // One broad pointed cap with a narrow split, rather than two ear-like prongs.
      for(const side of [-1,1]){
        const shape=new THREE.Shape();shape.moveTo(side*.006,0);shape.lineTo(side*.11,0);shape.bezierCurveTo(side*.19,.07,side*.16,.19,side*.015,.36);shape.bezierCurveTo(side*.036,.22,side*.034,.12,side*.006,.07);shape.closePath();
        add(new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelThickness:.025,bevelSize:.018,bevelSegments:3,curveSegments:12}),0,y+.15,-.07);
      }
      const book=add(new THREE.BoxGeometry(.17,.22,.035),-.03,.38*h,.216);book.rotation.z=-.17;
      line([[-.12,.33*h,.22],[-.06,.31*h,.25],[.05,.36*h,.23]],.018);
    } else if(type==='q') {
      add(new THREE.CylinderGeometry(.20,.16,.065,28),0,y+.19,0);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const point=add(new THREE.ConeGeometry(.052,.20,12),Math.cos(a)*.15,y+.30,Math.sin(a)*.15);point.rotation.z=-Math.cos(a)*.22;}
      line([[-.22*width,.12*h,.13],[-.12*width,.36*h,.21],[0,.57*h,.19],[.13*width,.38*h,.20],[.23*width,.12*h,.12]],.014);
    } else if(type==='k') {
      add(new THREE.CylinderGeometry(.20,.17,.065,28),0,y+.19,0);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;oval(Math.cos(a)*.105,y+.28,Math.sin(a)*.105,.085,.095,.085);}
      oval(0,y+.32,0,.08,.09,.08);
      line([[-.24*width,.10*h,.12],[-.13*width,.38*h,.20],[0,.60*h,.17],[.13*width,.38*h,.20],[.24*width,.10*h,.12]],.015);
    }
  }
  // Bake static parts into two meshes per piece to keep animation smooth on a full board.
  for(const material of [body,shade]) {
    const parts=upper.children.filter(part=>part.material===material);
    if(!parts.length) continue;
    const geometry=parts.map(part=>{part.updateMatrix();const copy=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();copy.applyMatrix4(part.matrix);return copy});
    const combined=mergeGeometries(geometry,false);
    for(const g of geometry)g.dispose();
    for(const part of parts){upper.remove(part);part.geometry.dispose()}
    if(combined){const mesh=new THREE.Mesh(combined,material);mesh.castShadow=true;mesh.receiveShadow=true;upper.add(mesh)}
  }
  const asset=upper.children.map(part=>({geometry:part.geometry,material:part.material,ownedMaterial:part.material===shade}));
  pieceAssets.set(key,asset);
  for(const part of upper.children)part.userData.sharedPiece=true;
  return finish();
}
