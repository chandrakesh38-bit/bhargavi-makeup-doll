'use strict';
// One pointer, one gesture. Shared control activation avoids Android synthetic-click suppression.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SVG_NS = 'http://www.w3.org/2000/svg';
const state = { tab:'makeup', tool:'lipstick', shade:'#d92d59', hair:'#513521', hairStyle:0, dress:'#ff75a5', crown:false, necklace:false, earrings:false, rotation:0, sound:true };
let gesture = { mode:'idle' };
let audioContext, installPrompt, lickTimer, chewTimer, soundTime = 0;
const scene = $('#dollScene');
const ghost = $('#dragGhost');
const hairPaths = [
 ['M103 142Q111 69 180 67Q249 69 257 142Q225 115 199 108Q168 133 103 142Z','M84 155Q72 60 180 48Q288 60 276 155L270 280Q225 310 180 302Q135 310 90 280Z'],
 ['M101 146Q111 75 180 72Q247 75 259 146Q226 111 180 116Q135 112 101 146Z','M92 157Q79 77 180 58Q281 77 268 157L252 250Q220 271 180 270Q140 271 108 250Z'],
 ['M103 142Q111 69 180 67Q249 69 257 142Q225 115 199 108Q168 133 103 142Z','M82 158Q70 58 180 47Q290 58 278 158L293 340Q236 366 180 348Q124 366 67 340Z']
];
// Pointer-up is authoritative for touch/mouse. Native click is used only for keyboard/AT.
// Do not prevent pointer events on controls: they retain normal focus and scrolling.
function activate(button, action) {
 button.addEventListener('pointerup', event => {
  const r=button.getBoundingClientRect();
  if(event.button===0 && event.clientX>=r.left && event.clientX<=r.right && event.clientY>=r.top && event.clientY<=r.bottom) action(event);
 });
 button.addEventListener('click', event => { if(event.detail===0 && !event.pointerType) action(event); });
}
function sound(kind) {
 if (!state.sound) return;
 const patterns = { lipstick:[320,390], brush:[180,250], dress:[523,784], accessory:[659,988], eat:[260,310,220], lick:[520,630], invalid:[230,190], celebrate:[523,659,784,1046], tap:[660] };
 try {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
  (patterns[kind] || patterns.tap).forEach((freq,i)=>{
   const start=audioContext.currentTime+i*.075, osc=audioContext.createOscillator(), gain=audioContext.createGain();
   osc.type='sine'; osc.frequency.setValueAtTime(freq,start);
   gain.gain.setValueAtTime(.0001,start); gain.gain.linearRampToValueAtTime(.025,start+.012); gain.gain.exponentialRampToValueAtTime(.0001,start+.12);
   osc.connect(gain).connect(audioContext.destination); osc.start(start); osc.stop(start+.13);
  });
 } catch { /* The game also works on browsers without Web Audio. */ }
}
function message(text) { const el=$('#dropMessage'); el.textContent=text; el.classList.add('show'); clearTimeout(message.timer); message.timer=setTimeout(()=>el.classList.remove('show'),1600); }
function sparkle(x,y,emoji='✨') { const el=document.createElement('div'); el.className='paint-spark'; el.textContent=emoji; el.style.left=x+'px'; el.style.top=y+'px'; document.body.append(el); setTimeout(()=>el.remove(),600); }
function animateDoll() { $('#doll3d').animate([{scale:'.96'},{scale:'1.04'},{scale:'1'}],{duration:350}); }
function renderAppearance() {
 ['hairBackF','hairFrontF','hairBackB','sideHair','sideFringe'].forEach(id=>$('#'+id).setAttribute('fill',state.hair));
 const [front,back]=hairPaths[state.hairStyle]; $('#hairFrontF').setAttribute('d',front);
 ['hairBackF','hairBackB'].forEach(id=>$('#'+id).setAttribute('d',back));
 $('#sideHair').setAttribute('d',state.hairStyle===1?'M125 165Q100 62 176 56Q231 64 227 157L219 240L124 240Z':state.hairStyle===2?'M125 165Q100 62 176 56Q231 64 227 157L232 350L114 350Z':'M125 165Q100 62 176 56Q231 64 227 157L219 290L124 290Z');
 ['dressF','dressTopF','dressB','sideDress'].forEach(id=>$('#'+id).setAttribute('fill',state.dress));
 ['crown','necklace','earrings'].forEach(key=>{ $('#'+key+'F').setAttribute('opacity',state[key]?1:0); $('#side'+key[0].toUpperCase()+key.slice(1)).setAttribute('opacity',state[key]?1:0); });
}
// Crossfade front / profile / back sprites, retaining width at the side rather than a flat card edge.
function renderRotation() {
 const angle=((state.rotation%360)+360)%360;
 const quadrant=Math.floor(angle/90), t=(angle%90)/90;
 const front=$('.doll-face.front'), back=$('.doll-face.back'), side=$('.doll-face.side');
 const weights=[[1-t,t,0],[0,1-t,t],[0,t,1-t],[t,1-t,0]][quadrant];
 [front,side,back].forEach((el,i)=>{ el.style.opacity=weights[i]; el.style.visibility=weights[i]>.001?'visible':'hidden'; });
 side.style.transform=angle>180?'scaleX(-1)':'scaleX(1)';
 $('#doll3d').dataset.angle=String(Math.round(angle));
}
function faceFront() { state.rotation=0; renderRotation(); }
function svgPoint(x,y) {
 const matrix=$('#frontSvg').getScreenCTM(); if(!matrix) return null;
 return new DOMPoint(x,y).matrixTransform(matrix.inverse());
}
function inEllipse(p,cx,cy,rx,ry) { return ((p.x-cx)/rx)**2+((p.y-cy)/ry)**2<=1; }
function target(type,p,key) {
 if(!p) return false;
 if(type==='dress') return p.x>95&&p.x<265&&p.y>285&&p.y<525;
 if(type==='hair'||key==='crown') return inEllipse(p,180,120,110,100);
 if(key==='necklace') return inEllipse(p,180,295,65,38);
 if(key==='earrings') return inEllipse(p,101,192,30,36)||inEllipse(p,259,192,30,36);
 return inEllipse(p,180,227,44,32);
}
function paint(p) {
 if(!p) return;
 let layer, radius, opacity, accepted=false, q={x:p.x,y:p.y};
 if(state.tool==='lipstick') {
  accepted=inEllipse(p,180,226,43,28); layer='lipPaint'; radius=6; opacity=.7;
  // Expand the finger target, then project onto the nearby lip edge. Paint remains clipped.
  q.x=Math.max(156,Math.min(204,q.x)); q.y=Math.max(218,Math.min(236,q.y));
 } else {
  const centers=state.tool==='blush'?[[128,203],[232,203]]:[[149,151],[211,151]];
  const [cx,cy]=centers.reduce((a,b)=>Math.hypot(p.x-a[0],p.y-a[1])<Math.hypot(p.x-b[0],p.y-b[1])?a:b);
  accepted=inEllipse(p,cx,cy,state.tool==='blush'?36:34,state.tool==='blush'?30:23);
  q.x=Math.max(cx-20,Math.min(cx+20,p.x)); q.y=Math.max(cy-9,Math.min(cy+9,p.y));
  layer=state.tool==='blush'?'blushPaint':'shadowPaint'; radius=state.tool==='blush'?12:8; opacity=.09;
 }
 if(!accepted) { gesture.previous=null; return; }
 let path=gesture.paintPath;
 if(!path||gesture.previous===null) {
  path=document.createElementNS(SVG_NS,'path'); path.setAttribute('fill','none'); path.setAttribute('stroke',state.shade); path.setAttribute('stroke-width',radius*2); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round'); path.setAttribute('opacity',opacity); path.setAttribute('d',`M${q.x} ${q.y}l.01 .01`); $('#'+layer).append(path); gesture.paintPath=path;
 } else {
  // Lipstick is a continuous local stroke; soft brushes accumulate separate translucent dabs.
  if(state.tool==='lipstick') path.setAttribute('d',path.getAttribute('d')+`L${q.x} ${q.y}`);
  else { const dot=document.createElementNS(SVG_NS,'circle'); dot.setAttribute('cx',q.x); dot.setAttribute('cy',q.y); dot.setAttribute('r',radius); dot.setAttribute('fill',state.shade); dot.setAttribute('opacity',opacity); $('#'+layer).append(dot); }
 }
 gesture.previous=q; gesture.painted=true;
 if(performance.now()-soundTime>130) { soundTime=performance.now(); sound(state.tool==='lipstick'?'lipstick':'brush'); }
}
function openMouth(open) { $('#eatingMouth').setAttribute('opacity',open?1:0); ['lips','lipPaint','lipLine'].forEach(id=>$('#'+id).style.visibility=open?'hidden':'visible'); }
function chew(lick=false) {
 clearInterval(chewTimer); let count=0; openMouth(true);
 chewTimer=setInterval(()=>{ openMouth(++count%2===0); if(count>= (lick?3:7)) { clearInterval(chewTimer); chewTimer=null; openMouth(false); } },lick?120:140);
}
function stopFeeding() { clearInterval(lickTimer); lickTimer=null; clearInterval(chewTimer); chewTimer=null; openMouth(false); }
function cancelGesture() {
 const old=gesture; gesture={mode:'idle'}; scene.dataset.mode='idle';
 clearInterval(lickTimer); lickTimer=null;
 if(old.source&&old.source.hasPointerCapture?.(old.pointerId)) old.source.releasePointerCapture(old.pointerId);
 old.source?.classList.remove('dragging'); ghost.classList.add('hidden');
 $$('.target-glow').forEach(el=>el.classList.remove('target-glow'));
}
function startGesture(e,mode,source,data={}) {
 if(e.button!==0 || !e.isPrimary || gesture.mode!=='idle') return false;
 e.preventDefault(); gesture={mode,pointerId:e.pointerId,source,startX:e.clientX,startRotation:state.rotation,previous:null,...data}; scene.dataset.mode=mode;
 source.setPointerCapture(e.pointerId); return true;
}
function moveGhost(e) { ghost.style.left=e.clientX+'px'; ghost.style.top=e.clientY+'px'; }
function dragItem(e,source,data) {
 faceFront(); if(!startGesture(e,'dragging-'+data.type,source,{item:data})) return;
 source.classList.add('dragging'); ghost.innerHTML=source.querySelector('.item-art').outerHTML; ghost.classList.remove('hidden'); moveGhost(e);
 message(data.type==='food'?'To her mouth 😋':data.type==='dress'?'Onto her dress 👗':data.type==='hair'?'Onto her head 💇':'Find the right spot ✨');
}
function updateLollipop(p,e) {
 const valid=target('food',p);
 if(valid&&!lickTimer) {
  const lick=()=>{chew(true); sound('lick'); sparkle(e.clientX,e.clientY,'💖'); gesture.licks=(gesture.licks||0)+1;};
  lick(); lickTimer=setInterval(lick,550);
 } else if(!valid&&lickTimer) { clearInterval(lickTimer); lickTimer=null; openMouth(false); }
}
scene.addEventListener('pointerdown',e=>{
 const p=svgPoint(e.clientX,e.clientY);
 if(state.tab==='makeup' && p && p.y<275 && p.y>65 && p.x>65&&p.x<295) {
  faceFront(); if(startGesture(e,'makeup',scene)) paint(svgPoint(e.clientX,e.clientY));
 } else startGesture(e,'rotating',scene);
});
addEventListener('pointermove',e=>{
 if(e.pointerId!==gesture.pointerId) return;
 if(gesture.mode==='makeup') paint(svgPoint(e.clientX,e.clientY));
 else if(gesture.mode==='rotating') { state.rotation=gesture.startRotation+(e.clientX-gesture.startX)*1.3; renderRotation(); }
 else if(gesture.item) {
  moveGhost(e); const p=svgPoint(e.clientX,e.clientY), d=gesture.item;
  scene.classList.toggle('target-glow',target(d.type,p,d.key));
  if(d.key==='lollipop') updateLollipop(p,e);
 }
});
function finishGesture(e) {
 if(e.pointerId!==gesture.pointerId) return;
 const g=gesture, p=svgPoint(e.clientX,e.clientY);
 if(g.mode==='makeup') paint(p);
 cancelGesture(); // Release capture before any UI changes or animation.
 if(g.item) {
  const d=g.item;
  if(!target(d.type,p,d.key)) { sound('invalid'); message('Try here again 💖'); g.source.animate([{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'none'}],{duration:230}); return; }
  if(d.type==='dress') state.dress=d.color;
  if(d.type==='hair') state.hairStyle=d.style;
  if(d.type==='accessory') state[d.key]=true;
  if(d.type==='food') { chew(d.key==='lollipop'); sound(d.key==='lollipop'?'lick':'eat'); message(d.key==='lollipop'?'Little licks 🍭':'Yummy! 😋'); }
  else { renderAppearance(); animateDoll(); sound(d.type==='accessory'?'accessory':'dress'); message('Beautiful! ✨'); }
  sparkle(e.clientX,e.clientY);
 } else if(g.mode==='makeup') message(g.painted?'Beautiful! 💖':'Rub the right spot 💄');
}
addEventListener('pointerup',finishGesture);
addEventListener('pointercancel',e=>{if(e.pointerId===gesture.pointerId) {cancelGesture(); stopFeeding();}});
addEventListener('lostpointercapture',e=>{if(e.pointerId===gesture.pointerId) cancelGesture();},true);
addEventListener('blur',()=>{cancelGesture(); stopFeeding();});
document.addEventListener('visibilitychange',()=>{if(document.hidden) {cancelGesture(); stopFeeding();}});
function hint() { $('#spinHint').textContent=state.tab==='makeup'?({lipstick:'💄 Rub her lips',blush:'🖌️ Rub her cheeks',shadow:'🪄 Rub above her eyes'}[state.tool])+' • drag dress to spin':'↔ Drag doll to spin • dress up & feed'; }
function selectTab(tab) {
 cancelGesture(); stopFeeding(); state.tab=tab;
 if(tab==='makeup') faceFront();
 $$('.tab').forEach(el=>{ const selected=el.dataset.tab===tab; el.classList.toggle('active',selected); el.setAttribute('aria-pressed',selected); });
 $$('.panel').forEach(el=>el.classList.toggle('active',el.id==='panel-'+tab)); hint();
}
$$('.tab').forEach(el=>activate(el,()=>{selectTab(el.dataset.tab);sound('tap');}));
$$('.tool-card').forEach(el=>activate(el,()=>{
 cancelGesture(); stopFeeding(); state.tool=el.dataset.tool; faceFront();
 $$('.tool-card').forEach(t=>{const selected=t===el;t.classList.toggle('selected',selected);t.setAttribute('aria-pressed',selected);}); hint(); sound('tap');
}));
function shades(selector,colors,choose,prefix) {
 colors.forEach((color,i)=>{const b=document.createElement('button');b.className='shade'+(!i?' selected':'');b.style.background=color;b.setAttribute('aria-label',prefix+' shade '+(i+1));b.setAttribute('aria-pressed',!i);activate(b,()=>{cancelGesture();choose(color);[...b.parentNode.children].forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',el===b);});sound('tap');});$(selector).append(b);});
}
shades('#makeupShades',['#d92d59','#ef4f7b','#b63b92','#ff7594','#9f2f59','#df56b1'],c=>state.shade=c,'Makeup');
shades('#hairShades',['#513521','#211b1a','#854727','#b16f3f','#6a3954'],c=>{state.hair=c;renderAppearance();},'Hair');
function item(container,label,data,art) { const b=document.createElement('button'); b.className='drag-item'; b.dataset.item=data.key||label.toLowerCase(); b.setAttribute('aria-label','Drag '+label); b.innerHTML=`<span class="item-art">${art}</span><b>${label}</b>`; b.addEventListener('pointerdown',e=>dragItem(e,b,data)); $(container).append(b); }
[['Rose','#ff75a5'],['Purple','#9a70dc'],['Blue','#62a9ec'],['Sun','#f1bd54'],['Red','#e75468']].forEach(([label,color])=>item('#dressStrip',label,{type:'dress',color},`<svg viewBox="0 0 60 70"><path d="M20 3L40 3L46 19L40 26L57 66Q30 74 3 66L20 26L14 19Z" fill="${color}"/><path d="M23 4Q30 15 37 4M15 48Q30 57 45 48" stroke="#fff" stroke-width="3" fill="none"/><circle cx="30" cy="30" r="4" fill="#fff7b0"/></svg>`));
[['Classic',0],['Bob',1],['Long',2]].forEach(([label,style])=>item('#hairStrip',label,{type:'hair',style},`<svg viewBox="0 0 60 70"><path d="M8 30Q5 3 30 3Q55 3 52 30L${style===1?'49 48Q30 58 11 48':style===2?'58 68Q30 61 2 68':'50 61Q30 67 10 61'}Z" fill="#513521"/><ellipse cx="30" cy="29" rx="16" ry="20" fill="#ffd5bb"/><path d="M13 25Q12 7 30 7Q48 7 47 24L32 18Z" fill="#513521"/></svg>`));
[['Crown','crown','👑'],['Necklace','necklace','📿'],['Earrings','earrings','💎']].forEach(([label,key,art])=>item('#prettyStrip',label,{type:'accessory',key},art));
[['Ice Cream','icecream','🍦'],['Popcorn','popcorn','🍿'],['Jalebi','jalebi','<svg viewBox="0 0 60 60"><path d="M45 45C5 65 0 10 30 8C63 6 66 55 31 52C4 49 13 17 32 17C52 17 52 42 32 43C19 42 20 27 32 26C42 26 41 36 32 36" stroke="#f58e19" stroke-width="7" fill="none" stroke-linecap="round"/></svg>'],['Lollipop','lollipop','🍭'],['Fries','fries','🍟']].forEach(([label,key,art])=>item('#foodStrip',label,{type:'food',key},art));
activate($('#resetBtn'),()=>{
 cancelGesture();stopFeeding();Object.assign(state,{tool:'lipstick',shade:'#d92d59',hair:'#513521',hairStyle:0,dress:'#ff75a5',crown:false,necklace:false,earrings:false,rotation:0});
 ['lipPaint','blushPaint','shadowPaint'].forEach(id=>$('#'+id).replaceChildren());
 ['#makeupShades','#hairShades','.makeup-row'].forEach(selector=>[...$(selector).children].forEach((el,i)=>{el.classList.toggle('selected',i===0);el.setAttribute('aria-pressed',i===0);}));
 renderAppearance();renderRotation();selectTab('makeup');message('Fresh start! 🌸');sound('tap');
});
activate($('#readyBtn'),()=>{cancelGesture();stopFeeding();sound('celebrate');animateDoll();message('Bhargavi’s doll is ready! 💖');for(let i=0;i<16;i++) setTimeout(()=>sparkle(innerWidth*(.2+Math.random()*.6),innerHeight*(.15+Math.random()*.4),['✨','💖','🌸'][i%3]),i*45);});
activate($('#soundBtn'),()=>{cancelGesture();state.sound=!state.sound;$('#soundBtn').textContent=state.sound?'🔊':'🔇';$('#soundBtn').setAttribute('aria-label',state.sound?'Sound on':'Sound off');$('#soundBtn').setAttribute('aria-pressed',state.sound);if(state.sound)sound('tap');});
activate($('#playBtn'),()=>{$('#startScreen').hidden=true;$('.app').inert=false;sound('celebrate');});
async function install() {
 cancelGesture(); if(matchMedia('(display-mode: standalone)').matches) {message('Already installed 👍');return;}
 if(installPrompt) {const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;}
 else {$('#installHelp').classList.remove('hidden');$('#closeInstallHelp').focus();}
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
activate($('#installBtn'),install);activate($('#installBtnStart'),install);
activate($('#closeInstallHelp'),()=>$('#installHelp').classList.add('hidden'));
addEventListener('keydown',e=>{if(e.key==='Escape') {cancelGesture();stopFeeding();$('#installHelp').classList.add('hidden');}});
renderAppearance();renderRotation();selectTab('makeup');$('.tool-card').classList.add('selected');$('.tool-card').setAttribute('aria-pressed','true');
// Network-first shell, automatic worker activation, and a reload only at a safe idle point.
if('serviceWorker' in navigator) {
 let initialController=!!navigator.serviceWorker.controller, reloadPending=false;
 const safeReload=()=>{if(reloadPending&&gesture.mode==='idle') location.reload();};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(initialController) {reloadPending=true;message('New game update ✨');setTimeout(safeReload,1600);} initialController=true;});
 addEventListener('pointerup',()=>setTimeout(safeReload,0));
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
  reg.update().catch(()=>{}); document.addEventListener('visibilitychange',()=>{if(!document.hidden) reg.update().catch(()=>{});});
 }).catch(()=>message('Offline play unavailable right now'));
}
