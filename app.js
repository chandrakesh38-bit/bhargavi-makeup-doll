const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
let soundOn=true,audioCtx,deferredPrompt=null;
const state={lip:'#ec5579',blush:'#ff91a8',eye:'#f4a0c8',dress:'#ff6f9e',hair:'#49311f',hairStyle:0,crown:false,necklace:false,earrings:false};
const defaults={...state};
function audio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}
function tone(freq=440,dur=.09,type='sine',gain=.045,slide=0){if(!soundOn)return;const c=audio(),o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);if(slide)o.frequency.linearRampToValueAtTime(freq+slide,c.currentTime+dur);g.gain.setValueAtTime(gain,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+dur);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+dur)}
function sfx(kind){if(kind==='lip'){tone(520,.06,'sine',.035,90);setTimeout(()=>tone(620,.05,'sine',.025),55)}else if(kind==='brush'){tone(170,.10,'triangle',.025,95)}else if(kind==='dress'){tone(560,.08,'sine',.035,180);setTimeout(()=>tone(820,.09,'sine',.03,80),70)}else if(kind==='ting'){tone(980,.12,'sine',.035,180)}else if(kind==='reset'){tone(330,.12,'triangle',.025,-100)}else if(kind==='ready'){[523,659,784,1046].forEach((n,i)=>setTimeout(()=>tone(n,.17,'sine',.045,50),i*95))}else if(kind==='play'){[392,523,659].forEach((n,i)=>setTimeout(()=>tone(n,.15,'sine',.04,40),i*75))}}
function pop(){const d=$('#dollWrap');d.classList.remove('pop');void d.offsetWidth;d.classList.add('pop')}
function sparkle(n=7){for(let i=0;i<n;i++){const e=document.createElement('span');e.className='spark';e.textContent=['✨','💖','⭐','🌸'][Math.floor(Math.random()*4)];e.style.left=(15+Math.random()*70)+'%';e.style.top=(35+Math.random()*45)+'%';e.style.animationDelay=(Math.random()*180)+'ms';$('#sparkles').appendChild(e);setTimeout(()=>e.remove(),1200)}}
function swatches(id,colors,key,sound){const box=$(id);colors.forEach(c=>{const b=document.createElement('button');b.className='swatch';b.style.background=c;b.setAttribute('aria-label',`${key} color`);b.onclick=()=>{state[key]=c;apply();mark(b,box);sfx(sound);pop()};box.appendChild(b)})}
function mark(el,parent){[...parent.children].forEach(x=>x.classList.remove('selected'));el.classList.add('selected')}
function apply(){
  $('#lips').setAttribute('fill',state.lip);$('#blushL').setAttribute('fill',state.blush);$('#blushR').setAttribute('fill',state.blush);
  $('#eyeShadowL').setAttribute('stroke',state.eye);$('#eyeShadowR').setAttribute('stroke',state.eye);
  $('#dress').setAttribute('fill',state.dress);$('#dressTop').setAttribute('fill',state.dress);
  $('#backHair').setAttribute('fill',state.hair);$('#frontHair').setAttribute('fill',state.hair);
  $('#crown').setAttribute('opacity',state.crown?1:0);$('#necklace').setAttribute('opacity',state.necklace?1:0);$('#earrings').setAttribute('opacity',state.earrings?1:0);setHairStyle(state.hairStyle)
}
function setHairStyle(n){const f=$('#frontHair'),b=$('#backHair');if(n===0){f.setAttribute('d','M104 135 Q110 78 170 78 Q226 80 236 136 Q210 116 188 110 Q160 130 104 135Z');b.setAttribute('d','M87 155 Q76 72 170 58 Q264 72 253 155 L250 257 Q215 285 170 280 Q125 285 90 257Z')}if(n===1){f.setAttribute('d','M103 140 Q106 78 170 76 Q235 82 237 143 Q204 106 170 108 Q134 107 103 140Z');b.setAttribute('d','M92 153 Q82 85 170 61 Q258 86 248 153 L235 235 Q209 252 170 252 Q131 252 105 235Z')}if(n===2){f.setAttribute('d','M105 138 Q112 80 170 78 Q229 80 235 138 Q210 103 173 111 Q150 91 105 138Z');b.setAttribute('d','M89 157 Q79 72 170 57 Q261 72 251 157 L266 302 Q220 325 170 309 Q120 325 74 302Z')}}
function choices(id,items,onPick){const box=$(id);items.forEach((it,i)=>{const b=document.createElement('button');b.className='choice';b.innerHTML=it.label;b.onclick=()=>{mark(b,box);onPick(it,i);pop()};box.appendChild(b)})}
function showInstallHelp(){
  const isIos=/iphone|ipad|ipod/i.test(navigator.userAgent);
  $('#installHelpText').innerHTML=isIos?'Safari Share button → <b>Add to Home Screen</b>':'Chrome menu ⋮ → <b>Add to Home screen</b> → Install';
  $('#installHelp').classList.remove('hidden');
}
async function installApp(){
  if(window.matchMedia('(display-mode: standalone)').matches){alert('App is already installed 👍');return}
  if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;return}
  showInstallHelp();
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});
window.addEventListener('appinstalled',()=>{deferredPrompt=null});

swatches('#lipColors',['#ec5579','#d72f52','#b43e88','#ff7b94','#9d315a','#e956ae'],'lip','lip');
swatches('#blushColors',['#ff91a8','#f79ac0','#f48f86','#df7baa','#f6b0aa'],'blush','brush');
swatches('#eyeColors',['#f4a0c8','#b998e8','#88bff0','#b99b6b','#8dc9aa'],'eye','brush');
swatches('#hairColors',['#49311f','#201b1a','#8a4e2c','#b07143','#693b54'],'hair','dress');
choices('#dressOptions',[{label:'🌸<br>Pink',c:'#ff6f9e'},{label:'💜<br>Purple',c:'#9a70dc'},{label:'🌊<br>Blue',c:'#62a9ec'},{label:'🌼<br>Yellow',c:'#f1bd54'},{label:'🍓<br>Red',c:'#e75468'}],it=>{state.dress=it.c;apply();sfx('dress');sparkle(4)});
choices('#hairStyles',[{label:'🎀<br>Classic'},{label:'🌷<br>Bob'},{label:'🦋<br>Long'}],(_,i)=>{state.hairStyle=i;apply();sfx('dress')});
choices('#accessoryOptions',[{label:'👑<br>Crown',k:'crown'},{label:'📿<br>Necklace',k:'necklace'},{label:'✨<br>Earrings',k:'earrings'}],it=>{state[it.k]=!state[it.k];apply();sfx('ting');sparkle(5)});
$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');$$('.panel').forEach(x=>x.classList.remove('active'));$('#panel-'+t.dataset.tab).classList.add('active');sfx('ting')});
$('#soundBtn').onclick=()=>{soundOn=!soundOn;$('#soundBtn').textContent=soundOn?'🔊':'🔇';$('#soundBtn').setAttribute('aria-label',soundOn?'Sound on':'Sound off');if(soundOn)sfx('ting')};
$('#resetBtn').onclick=()=>{Object.assign(state,defaults);apply();$$('.selected').forEach(x=>x.classList.remove('selected'));sfx('reset');pop()};
$('#readyBtn').onclick=()=>{sfx('ready');sparkle(20);const d=$('#dollWrap'),b=$('#readyBubble');d.classList.remove('celebrate');void d.offsetWidth;d.classList.add('celebrate');b.classList.add('show');setTimeout(()=>b.classList.remove('show'),1900)};
$('#playBtn').onclick=()=>{sfx('play');$('#startScreen').classList.add('hide');setTimeout(()=>$('#startScreen').style.display='none',380)};
$('#installBtn').onclick=installApp;$('#installBtnStart').onclick=installApp;$('#closeInstallHelp').onclick=()=>$('#installHelp').classList.add('hidden');
apply();
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));