import { nearest, normalizeWord } from './data.js';
import wordData from './word-data.js';

const $ = id => document.getElementById(id);
const canvas = $('universe'), overlay = $('overlay'), ctx = overlay.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let width = innerWidth, height = innerHeight, ratio = 1;
let words = [], mode = 'tsne', selected = null, neighbors = [], positions = [], projected = [];
let camera = [0, 0, 180], yaw = 0, pitch = 0, flight = null, last = 0, elapsed = 0;
let discovered = new Set(), toastTimer, dragging = null, joystick = [0, 0], altitude = 0;
const keys = new Set();
let gl, program, buffer, vertexData;
const colors = [[.66,.80,.95],[.88,.78,.62],[.60,.71,.93],[.64,.87,.84],[.88,.87,.97]];
const background = Array.from({length:700}, (_,i) => {
  const random = n => { const v = Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
  const a=random(i+1)*Math.PI*2, z=random(i+800)*2-1, r=Math.sqrt(1-z*z);
  return { p:[Math.cos(a)*r*1800,z*1800,Math.sin(a)*r*1800], brightness:random(i+1500) };
});

function toast(message, persistent = false) {
  clearTimeout(toastTimer); $('toast').textContent=message; $('toast').style.opacity=1;
  if (!persistent) toastTimer=setTimeout(() => $('toast').style.opacity=0,4200);
}
function setupGL() {
  gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false});
  if (!gl) throw new Error('WebGL is unavailable. Enable hardware acceleration or try another browser.');
  const compile=(type,source) => { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error('Could not initialize the star renderer.'); return s; };
  program=gl.createProgram();
  gl.attachShader(program,compile(gl.VERTEX_SHADER,`attribute vec2 a_position; attribute vec3 a_color; attribute float a_size; varying vec3 v_color; void main(){ gl_Position=vec4(a_position,0.,1.); gl_PointSize=a_size; v_color=a_color; }`));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`precision mediump float; varying vec3 v_color; void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; float core=exp(-d*d*32.);float halo=pow(1.-d,2.)*.30; gl_FragColor=vec4(v_color,core+halo);}`));
  gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Could not initialize the star renderer.');
  gl.useProgram(program); buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  for(const [name,size,offset] of [['a_position',2,0],['a_color',3,8],['a_size',1,20]]) { const loc=gl.getAttribLocation(program,name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,size,gl.FLOAT,false,24,offset); }
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE); gl.clearColor(0,0,0,0);
}
function resize(){width=innerWidth;height=innerHeight;ratio=Math.min(devicePixelRatio || 1,2);canvas.width=overlay.width=Math.round(width*ratio);canvas.height=overlay.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);if(gl)gl.viewport(0,0,canvas.width,canvas.height);}
function mapPositions(){
  const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
  for(const w of words) w[mode].forEach((v,i)=>{mins[i]=Math.min(mins[i],v);maxs[i]=Math.max(maxs[i],v);});
  const scale=140/Math.max(...maxs.map((v,i)=>v-mins[i]),.00001);
  positions=words.map(w=>w[mode].map((v,i)=>(v-(mins[i]+maxs[i])/2)*scale));
  projected=words.map(()=>({x:0,y:0,z:0,visible:false}));
}
function basis(){
  const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
  return {right:[cy,0,sy],up:[-sy*sp,cp,cy*sp],forward:[sy*cp,sp,-cy*cp]};
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function project(p,b,out,sky=false){
  const d=sky?p:p.map((v,i)=>v-camera[i]),z=dot(d,b.forward),f=Math.min(width,height)*.95;
  out.z=z;out.x=width/2+dot(d,b.right)*f/z;out.y=height/2-dot(d,b.up)*f/z;
  out.visible=z>1 && out.x>-30 && out.x<width+30 && out.y>-30 && out.y<height+30; return out;
}
function reset(){camera=[0,0,width<760?215:180];yaw=0;pitch=0;flight=null;}
function select(word,fly=false){
  selected=word;neighbors=nearest(words,word,mode);discovered.add(word.word);
  $('selection').hidden=false;document.body.classList.add('has-selection');
  $('selected-word').textContent=word.word;
  $('coordinates').textContent=word[mode].map((v,i)=>'XYZ'[i]+' '+v.toFixed(2)).join('  ·  ');
  $('neighbors').replaceChildren();
  for(const [i,n] of neighbors.entries()){
    const button=document.createElement('button');button.className='neighbor';
    for(const [cls,text] of [['rank',String(i+1).padStart(2,'0')],['name',n.word.word],['distance',n.distance.toFixed(mode==='pca'?4:2)+' ↗']]){
      const span=document.createElement('span');span.className=cls;span.textContent=text;if(cls==='name'){span.lang='fa';span.dir='rtl';}button.append(span);
    }
    button.setAttribute('aria-label',`${n.word.word}, distance ${n.distance.toPrecision(4)}; explore word`);
    button.onclick=()=>select(n.word,true);$('neighbors').append(button);
  }
  $('discovered').textContent=discovered.size;$('progress').style.width=Math.min(discovered.size/10,1)*100+'%';
  $('journey-text').textContent=discovered.size>=10?'words · explorer':'words discovered';
  if(discovered.size===10)toast('First journey complete. Ten words, a new constellation.');
  if(fly||width<760)flyTo();
}
function flyTo(){
  if(!selected)return;const index=words.indexOf(selected),p=positions[index],b=basis();
  const distance=width<760?35:27;
  // Keep the destination above the detail sheet on portrait phones.
  const screenOffset=width<760 && height>550 ? (height*.25-height/2)*distance/(Math.min(width,height)*.95) : 0;
  const target=p.map((v,i)=>v-b.forward[i]*distance+b.up[i]*screenOffset);
  if(reducedMotion){camera=target;flight=null;}else flight={start:[...camera],target,t:0};
}
function closeSelection(){$('selection').hidden=true;document.body.classList.remove('has-selection');selected=null;neighbors=[];}
function render(time){
  const dt=Math.min((time-last)/1000 || .016,.05);last=time;elapsed+=dt;
  const b=basis();
  if(!$('help').open && document.activeElement!==$('search')){
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)-joystick[1];
    const side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joystick[0];
    const up=(keys.has('e')?1:0)-(keys.has('q')?1:0)+altitude;
    if(forward||side||up){flight=null;const speed=dt*(keys.has('shift')?60:22),norm=Math.max(1,Math.hypot(forward,side,up));camera=camera.map((v,i)=>v+(b.forward[i]*forward+b.right[i]*side+(i===1?up:0))*speed/norm);}
    if(flight){flight.t=Math.min(flight.t+dt/.95,1);const t=flight.t*flight.t*(3-2*flight.t);camera=flight.start.map((v,i)=>v+(flight.target[i]-v)*t);if(flight.t===1)flight=null;}
  }
  ctx.clearRect(0,0,width,height);let count=0;
  const push=(p,color,size)=>{const j=count++*6;vertexData[j]=p.x/width*2-1;vertexData[j+1]=1-p.y/height*2;vertexData.set(color,j+2);vertexData[j+5]=size*ratio;};
  for(const star of background){const p=project(star.p,b,{},true);if(p.visible)push(p,[.38,.47,.64],2+star.brightness*3);}
  const selectedIndex=selected?words.indexOf(selected):-1;
  const linked=new Set(neighbors.map(n=>words.indexOf(n.word)));
  for(let i=0;i<words.length;i++){
    const p=project(positions[i],b,projected[i]);if(!p.visible)continue;
    const active=i===selectedIndex||linked.has(i),size=active?22:Math.max(3,Math.min(14,650/p.z));
    push(p,active?[1,.83,.53]:colors[i%colors.length],size);
  }
  gl.clear(gl.COLOR_BUFFER_BIT);gl.bufferData(gl.ARRAY_BUFFER,vertexData.subarray(0,count*6),gl.DYNAMIC_DRAW);gl.drawArrays(gl.POINTS,0,count);
  if(selectedIndex>=0){const p=projected[selectedIndex];
    if(p.visible){for(const i of linked){const n=projected[i];if(n.z<=1)continue;const gradient=ctx.createLinearGradient(p.x,p.y,n.x,n.y);gradient.addColorStop(0,'#e9c991aa');gradient.addColorStop(1,'#e9c99130');ctx.strokeStyle=gradient;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(n.x,n.y);ctx.stroke();}
      ctx.strokeStyle='#e9c991aa';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,reducedMotion?12:12+Math.sin(elapsed*1.8)*1.5,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#e9c99122';ctx.beginPath();ctx.arc(p.x,p.y,21,0,Math.PI*2);ctx.stroke();
    }
  }
  const occupied=[];ctx.textAlign='center';ctx.textBaseline='top';
  function label(i,active=false){const p=projected[i];if(!p.visible)return;if(!active&&(p.y<100||p.y>height-80||(width>760&&p.x<340&&p.y<490)))return;const text=words[i].word;ctx.font=`${active?16:12}px Vazirmatn, Tahoma, sans-serif`;const w=ctx.measureText(text).width+18,x=p.x-w/2,y=p.y+(active?19:10);if(!active && occupied.some(r=>x<r.x+r.w&&x+w>r.x&&y<r.y+26&&y+24>r.y))return;occupied.push({x,y,w});ctx.fillStyle=active?'#edcf9c':'#c0cde0';ctx.shadowColor='#080e20';ctx.shadowBlur=6;ctx.fillText(text,p.x,y);ctx.shadowBlur=0;}
  if(selectedIndex>=0){label(selectedIndex,true);for(const i of linked)label(i,true);}
  let labels=0;const maxLabels=width<760?24:65;
  for(let i=0;i<words.length&&labels<maxLabels;i++){const p=projected[i];if(p.visible&&i!==selectedIndex&&!linked.has(i)&&(i%29===0||p.z<32)){const before=occupied.length;label(i);if(occupied.length>before)labels++;}}
  requestAnimationFrame(render);
}

function pick(x,y){let best=null,distance=matchMedia('(pointer:coarse)').matches?30:20;
  for(let i=0;i<projected.length;i++){const p=projected[i];if(!p.visible)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<distance){distance=d;best=words[i];}}
  if(best)select(best);else toast('Tap a glowing star, or search for a Persian word.');
}
canvas.addEventListener('pointerdown',e=>{if(dragging)return;canvas.focus();dragging={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;if(Math.hypot(e.clientX-dragging.startX,e.clientY-dragging.startY)>6)dragging.moved=true;if(dragging.moved){yaw-=dx*.004;pitch=Math.max(-1.5,Math.min(1.5,pitch+dy*.004));flight=null;}dragging.x=e.clientX;dragging.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!dragging||dragging.id!==e.pointerId)return;if(!dragging.moved)pick(e.clientX,e.clientY);dragging=null;});
canvas.addEventListener('pointercancel',()=>dragging=null);
canvas.addEventListener('lostpointercapture',()=>dragging=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();const b=basis();camera=camera.map((v,i)=>v-b.forward[i]*Math.max(-12,Math.min(12,e.deltaY*.025)));flight=null;},{passive:false});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){$('search-results').hidden=true;closeSelection();return;}
  if(document.activeElement===$('search')||$('help').open)return;
  if(e.key==='/'){e.preventDefault();$('search').focus();return;}
  if(['w','a','s','d','q','e','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase());}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function clearInputs(){keys.clear();joystick=[0,0];altitude=0;dragging=null;$('joystick-knob').style.transform='';}
window.addEventListener('blur',clearInputs);document.addEventListener('visibilitychange',clearInputs);
let stickPointer=null;
function updateStick(e){const r=$('joystick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.max(32,Math.hypot(dx,dy));joystick=[dx/l,dy/l];$('joystick-knob').style.transform=`translate(${joystick[0]*32}px,${joystick[1]*32}px)`;}
$('joystick').addEventListener('pointerdown',e=>{if(stickPointer!==null)return;stickPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);updateStick(e);});
$('joystick').addEventListener('pointermove',e=>{if(stickPointer===e.pointerId)updateStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,()=>{stickPointer=null;joystick=[0,0];$('joystick-knob').style.transform='';});
for(const [id,value] of [['rise',1],['fall',-1]]){
  $(id).addEventListener('pointerdown',e=>{$(id).setPointerCapture(e.pointerId);altitude=value;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(event,()=>altitude=0);
}
function search(){const query=normalizeWord($('search').value);$('search-results').replaceChildren();$('search-results').hidden=!query;if(!query)return;
  const results=words.filter(w=>normalizeWord(w.word).includes(query)).sort((a,b)=>(normalizeWord(b.word)===query)-(normalizeWord(a.word)===query)).slice(0,8);
  if(!results.length){const p=document.createElement('p');p.textContent='No words found. Try a shorter spelling.';$('search-results').append(p);}
  for(const word of results){const btn=document.createElement('button');btn.textContent=word.word;btn.lang='fa';btn.dir='rtl';btn.onclick=()=>{select(word,true);$('search-results').hidden=true;$('search').value='';$('search').blur();};$('search-results').append(btn);}
}
$('search').addEventListener('input',search);$('search').addEventListener('keydown',e=>{if(e.key==='Enter')$('search-results').querySelector('button')?.click();});
$('close-selection').onclick=closeSelection;$('fly-to').onclick=flyTo;
$('reset').onclick=()=>{reset();toast('Back to the full atlas.');};
for(const projection of ['tsne','pca'])$(projection).onclick=()=>{if(!words.length)return;mode=projection;mapPositions();reset();for(const m of ['tsne','pca']){$(m).classList.toggle('active',m===mode);$(m).setAttribute('aria-pressed',String(m===mode));}if(selected)select(selected);toast(`${mode==='tsne'?'t-SNE':'PCA'} map · neighbors recalculated`);};
$('help-button').onclick=()=>{clearInputs();$('help').showModal();};
for(const id of ['close-help','begin'])$(id).onclick=()=>$('help').close();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Fullscreen is not supported in this browser.');}catch{toast('Fullscreen is not available in this browser.');}};
window.addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('Graphics paused. Reload the page to restore the atlas.',true);});
try {
  setupGL();resize();
  words=wordData;if(!words.length)throw new Error('No word coordinates found in word-data.js.');
  vertexData=new Float32Array((words.length+background.length)*6);mapPositions();reset();
  $('word-count').textContent=words.length.toLocaleString()+' stars to explore';
  requestAnimationFrame(render);toast('Your universe is ready. Choose a star to begin.');
}catch(error){$('word-count').textContent='Atlas unavailable';toast(error.message,true);console.error(error);}
