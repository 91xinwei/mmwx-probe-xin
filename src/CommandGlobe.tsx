import { useEffect, useRef, useState, lazy, Suspense } from "react";
import * as THREE from "three";
import {layoutGlobeLabels,flagTwemojiFile} from "./globe-labels";
import { geoCentroid } from "d3-geo";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";
import world from "world-atlas/countries-110m.json";
import type { FeatureCollection } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
const Fallback = lazy(() => import("./RegionGlobe").then(m => ({default:m.RegionGlobe})));
function codeOf(region:string) {
  const chars=[...region.trim()];
  if(chars.length===2 && chars.every(c=>c.codePointAt(0)!>=0x1f1e6 && c.codePointAt(0)!<=0x1f1ff)) return chars.map(c=>String.fromCharCode(c.codePointAt(0)!-0x1f1e6+65)).join("");
  return /^[A-Z]{2}$/.test(region) ? region : "";
}
export function CommandGlobe({regions,spinning}:{regions:string[];spinning:boolean}) {
  const host=useRef<HTMLDivElement>(null);
  const spinningRef=useRef(spinning);
  const [fallback,setFallback]=useState(false);
  spinningRef.current=spinning;
  const signature=regions.join("|");
  useEffect(()=>{
    const el=host.current;
    if(!el) return;
    let renderer:THREE.WebGLRenderer;
    try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"}); }
    catch {setFallback(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(35,1,.1,100);
    camera.position.z=3.6;
    const group=new THREE.Group();group.rotation.y=Math.PI+.15;scene.add(group);
    const textures:THREE.Texture[]=[];
    let disposed=false;
    const loader=new THREE.TextureLoader();
    const load=(path:string)=>{const t=loader.load(path,()=>{if(disposed)t.dispose();},undefined,()=>setFallback(true));t.colorSpace=THREE.SRGBColorSpace;textures.push(t);return t;};
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,64,48),new THREE.MeshPhongMaterial({map:load("/space/earth-day.jpg"),emissiveMap:load("/space/earth-night.png"),emissive:new THREE.Color(0x80b5ed),emissiveIntensity:2.6,color:0x24506c,shininess:6}));
    const surface=sphere.material as THREE.MeshPhongMaterial;
    surface.onBeforeCompile=(shader)=>{shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`float edgeLight=pow(1.-max(dot(normalize(normal),normalize(vViewPosition)),0.),3.);
 outgoingLight+=vec3(.015,.18,.32)*edgeLight;
 #include <opaque_fragment>`);};
    group.add(sphere);
    // A view-dependent atmospheric scattering shell, rendered as real 3D geometry.
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(1.02,64,48),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,blending:THREE.AdditiveBlending,depthWrite:false,vertexShader:`varying vec3 n; varying vec3 p; void main(){vec4 v=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);p=v.xyz;gl_Position=projectionMatrix*v;}`,fragmentShader:`varying vec3 n; varying vec3 p; void main(){float f=1.-abs(dot(normalize(n),normalize(-p)));float rim=pow(f,2.)*pow(1.-f,.65);gl_FragColor=vec4(.08,.62,1.,rim*.28);}`}));
    group.add(atmosphere);
    scene.add(new THREE.AmbientLight(0x6686ad,.38));
    const sun=new THREE.DirectionalLight(0xc7eaff,1.5);sun.position.set(-3,4,4);scene.add(sun);
    const counts=new Map<string,number>();regions.forEach(r=>{const c=codeOf(r);if(c)counts.set(c,(counts.get(c)??0)+1);});
    const collection=feature(world as unknown as Topology,{type:"GeometryCollection",geometries:(world as unknown as Topology<{countries:GeometryCollection}>).objects.countries.geometries}) as unknown as FeatureCollection;
    const labels:{code:string;count:number;el:HTMLSpanElement;point:THREE.Vector3;mesh:THREE.Mesh}[]=[];
    for(const [code,count] of counts) {
      const country=collection.features.find(f=>countries.numericToAlpha2(String(f.id).padStart(3,"0"))===code);
      const coords=code==="HK"?[114.17,22.32]:code==="SG"?[103.82,1.35]:country?geoCentroid(country):undefined;
      if(!coords)continue;
      const [lon,lat]=coords.map(THREE.MathUtils.degToRad);
      const point=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon)).multiplyScalar(1.015);
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(.014,12,12),new THREE.MeshBasicMaterial({color:0x6aeaff}));mesh.position.copy(point);group.add(mesh);
      const label=document.createElement("span");label.className="command-map-label";
      const flag=document.createElement("img");flag.src=`/twemoji/svg/${flagTwemojiFile(code)}.svg`;flag.alt="";label.appendChild(flag);
      const names:Record<string,string>={US:"美国",GB:"英国",DE:"德国",JP:"日本",HK:"香港",SG:"新加坡"};
      label.appendChild(document.createTextNode(`${names[code]??code} · ${count} 台`));
      el.appendChild(label);labels.push({code,count,el:label,point,mesh});
    }
    const drag={active:false,x:0,y:0};
    const down=(e:PointerEvent)=>{drag.active=true;drag.x=e.clientX;drag.y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);};
    const move=(e:PointerEvent)=>{if(!drag.active)return;group.rotation.y+=(e.clientX-drag.x)*.006;group.rotation.x=THREE.MathUtils.clamp(group.rotation.x+(e.clientY-drag.y)*.004,-.65,.65);drag.x=e.clientX;drag.y=e.clientY;};
    const up=()=>{drag.active=false;};
    renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointermove",move);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointercancel",up);
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const reduce=matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0,last=performance.now();
    const animate=(now:number)=>{frame=requestAnimationFrame(animate);if(document.hidden){last=now;return;}if(now-last<32)return;const delta=Math.min(.1,(now-last)/1000);last=now;
      if(spinningRef.current && !drag.active && !reduce.matches)group.rotation.y+=delta*(Math.PI*2/30);
      group.updateMatrixWorld();
      const projected=labels.flatMap(({code,count,point})=>{const p=point.clone().applyMatrix4(group.matrixWorld);if(p.z<.12)return [];p.project(camera);return [{code,count,x:(p.x*.5+.5)*el.clientWidth,y:(-p.y*.5+.5)*el.clientHeight}];});
      const r=el.clientHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.sqrt(camera.position.z**2-1));
      const placed=layoutGlobeLabels(projected,{height:27,flag:65,digit:7,padding:8,gap:4,offset:12,dotRadius:7},{cx:el.clientWidth/2,cy:el.clientHeight/2,r});
      labels.forEach(({code,el:label})=>{const layout=placed.find(p=>p.code===code);label.hidden=!layout;if(layout){label.style.left=`${Math.max(2,Math.min(el.clientWidth-layout.width-2,layout.x))}px`;label.style.top=`${Math.max(2,Math.min(el.clientHeight-29,layout.y))}px`;}});
      renderer.render(scene,camera);
    };frame=requestAnimationFrame(animate);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("pointerdown",down);renderer.domElement.removeEventListener("pointermove",move);renderer.domElement.removeEventListener("pointerup",up);renderer.domElement.removeEventListener("pointercancel",up);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(v=>v.dispose());}});textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();labels.forEach(l=>l.el.remove());};
  },[signature,fallback]);
  return fallback ? <Suspense fallback={<p>正在加载地图…</p>}><Fallback regions={regions} autoRotate={spinning} showArcs={false}/></Suspense> : <div className="command-globe-canvas" ref={host} role="img" aria-label="可拖动旋转的三维地球，标记为国家或地区代表点"/>;
}
