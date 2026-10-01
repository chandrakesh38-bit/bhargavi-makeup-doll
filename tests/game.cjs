// Run: NODE_PATH=<playwright modules> CHROMIUM_MODULE=<optional module> node tests/game.cjs <url>
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const slim=process.env.CHROMIUM_MODULE?(await import(process.env.CHROMIUM_MODULE)).default:null;
 const proxyUrl=process.argv[2]?.startsWith('https:')&&(process.env.HTTPS_PROXY||process.env.HTTP_PROXY);
 const proxy=proxyUrl?{server:proxyUrl}:undefined;
 const launch=async()=>chromium.launch(slim?{executablePath:await slim.executablePath(),args:slim.args.filter(a=>!['--disable-web-security','--allow-running-insecure-content'].includes(a)),headless:true,proxy}:{headless:true,proxy});
 const url=process.argv[2]||'http://127.0.0.1:3000';const results=[];
 for(const mobile of [false,true]) {
  const browser=await launch();
  const context=await browser.newContext({viewport:mobile?{width:360,height:800}:{width:1100,height:900},hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const cdp=await context.newCDPSession(page);
  const check=async()=>assert.equal(await page.locator('#dollScene').getAttribute('data-mode'),'idle');
  const click=async s=>{if(mobile)await page.locator(s).tap();else await page.locator(s).click();if(s.startsWith('[data-tab')){const name=s.match(/"(.*?)"/)[1];try{await page.locator('#panel-'+name).waitFor({state:'visible',timeout:2000});}catch(e){await page.screenshot({path:'/tmp/doll-failure.png',fullPage:true});console.log(await page.evaluate(()=>window.eventTrace));throw e;}}};
  const point=async(x,y)=>page.evaluate(({x,y})=>{const m=document.querySelector('#frontSvg').getScreenCTM();const p=new DOMPoint(x,y).matrixTransform(m);return{x:p.x,y:p.y};},{x,y});
  async function down(p){if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,radiusX:7,radiusY:7}]});else{await page.mouse.move(p.x,p.y);await page.mouse.down();}}
  async function move(p){if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y,radiusX:7,radiusY:7}]});else await page.mouse.move(p.x,p.y);}
  async function up(){if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();}
  async function rub(x,y,dx=8){await down(await point(x,y));for(let i=1;i<=12;i++)await move(await point(x+Math.sin(i)*dx,y+Math.cos(i)*2));await up();await check();}
  async function drag(selector,x,y,hold=false){const box=await page.locator(selector).boundingBox();if(!box){await page.screenshot({path:'/tmp/doll-failure.png',fullPage:true});throw Error('Missing '+selector+' '+await page.locator('.tab.active').textContent());}const p={x:box.x+box.width/2,y:box.y+box.height/2};await down(p);const end=await point(x,y);for(let i=1;i<=10;i++)await move({x:p.x+(end.x-p.x)*i/10,y:p.y+(end.y-p.y)*i/10});if(hold)await page.waitForTimeout(1200);await up();await check();}
  const tabs=async()=>{for(const tab of ['makeup','dress','hair','pretty','food','makeup']){await click(`[data-tab="${tab}"]`);assert.equal(await page.locator(`#panel-${tab}`).isVisible(),true);await check();}};
  await page.goto(url);await page.evaluate(()=>{window.eventTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','click'])document.addEventListener(type,e=>{eventTrace.push([type,e.target.id||e.target.className,e.pointerId,e.clientX,e.clientY]);if(eventTrace.length>35)eventTrace.shift();},true);});await click('#installBtnStart');assert.equal(await page.locator('#installHelp').isVisible(),true);await click('#closeInstallHelp');await click('#playBtn');
  assert.equal(await page.locator('#startScreen').isVisible(),false);
  // Exactly the requested regression sequence, with appearance assertions.
  await click('[data-tool="lipstick"]');await rub(163,225,3);
  assert.equal(await page.locator('#lipPaint path').count(),1);
  assert.match(await page.locator('#lipPaint path').getAttribute('d'),/L/);
  assert.equal(await page.locator('#lipPaint').getAttribute('clip-path'),'url(#lipClip)');
  assert.equal(await page.locator('#doll3d').getAttribute('data-angle'),'0');
  await click('[data-tool="blush"]');await rub(128,203);
  assert.ok(await page.locator('#blushPaint circle').count()>5);
  const cheek=await page.locator('#blushPaint circle').evaluateAll(es=>es.map(e=>+e.getAttribute('cx')));assert.ok(cheek.every(x=>x<170),'Only left cheek painted');
  await click('[data-tool="shadow"]');await rub(149,151);
  assert.ok(await page.locator('#shadowPaint circle').count()>5);
  for(let i=0;i<6;i++)await click(`#makeupShades button:nth-child(${i+1})`);
  await click('[data-tab="dress"]');await drag('[data-item="purple"]',180,380);assert.equal(await page.locator('#dressF').getAttribute('fill'),'#9a70dc');
  await drag('[data-item="blue"]',180,160);assert.equal(await page.locator('#dressF').getAttribute('fill'),'#9a70dc','Wrong dress drop rejected');
  await click('[data-tab="hair"]');await drag('[data-item="bob"]',180,100);assert.match(await page.locator('#hairBackF').getAttribute('d'),/252 250/);
  await click('#hairShades button:nth-child(3)');assert.equal(await page.locator('#hairFrontF').getAttribute('fill'),'#854727');
  await click('[data-tab="pretty"]');await drag('[data-item="crown"]',180,80);assert.equal(await page.locator('#crownF').getAttribute('opacity'),'1');
  await drag('[data-item="necklace"]',180,295);assert.equal(await page.locator('#necklaceF').getAttribute('opacity'),'1');
  await drag('[data-item="earrings"]',180,420);assert.equal(await page.locator('#earringsF').getAttribute('opacity'),'0');
  await drag('[data-item="earrings"]',101,192);assert.equal(await page.locator('#earringsF').getAttribute('opacity'),'1');
  await click('[data-tab="food"]');await drag('[data-item="icecream"]',180,227);assert.match(await page.locator('#dropMessage').textContent(),/Yummy/);
  await page.waitForTimeout(1100);await drag('[data-item="lollipop"]',180,227,true);assert.match(await page.locator('#dropMessage').textContent(),/licks/);
  for(const food of ['popcorn','jalebi','fries']){await drag(`[data-item="${food}"]`,180,227);assert.match(await page.locator('#dropMessage').textContent(),/Yummy/);}
  await drag('[data-item="fries"]',180,420);assert.match(await page.locator('#dropMessage').textContent(),/Try/);
  await down(await point(160,380));await move(await point(250,380));await up();await check();assert.notEqual(await page.locator('#doll3d').getAttribute('data-angle'),'0');
  await click('[data-tab="makeup"]');assert.equal(await page.locator('#doll3d').getAttribute('data-angle'),'0');await click('[data-tool="lipstick"]');await rub(193,225,3);assert.equal(await page.locator('#lipPaint path').count(),2);
  await click('#resetBtn');for(const id of ['lipPaint','blushPaint','shadowPaint'])assert.equal(await page.locator(`#${id} > *`).count(),0);assert.equal(await page.locator('#crownF').getAttribute('opacity'),'0');await tabs();await tabs();
  // Cancellation releases the source capture and leaves every control reachable.
  await click('[data-tab="dress"]');let box=await page.locator('[data-item="rose"]').boundingBox();await down({x:box.x+box.width/2,y:box.y+box.height/2});
  if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});else await up();await check();await tabs();
  // Actual second-finger tab tap during an active captured drag.
  if(mobile){await click('[data-tab="food"]');box=await page.locator('[data-item="icecream"]').boundingBox();const p={x:box.x+box.width/2,y:box.y+box.height/2,id:1};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});const tb=await page.locator('[data-tab="hair"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p,{x:tb.x+tb.width/2,y:tb.y+tb.height/2,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await check();await tabs();}
  await click('#soundBtn');assert.equal(await page.locator('#soundBtn').getAttribute('aria-pressed'),'false');await click('#soundBtn');assert.equal(await page.locator('#soundBtn').getAttribute('aria-pressed'),'true');
  await page.locator('#soundBtn').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#soundBtn').getAttribute('aria-pressed'),'false');await page.keyboard.press('Space');assert.equal(await page.locator('#soundBtn').getAttribute('aria-pressed'),'true');
  await click('#readyBtn');assert.match(await page.locator('#dropMessage').textContent(),/ready/);await check();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow');
  await page.waitForTimeout(1700);
  await page.screenshot({path:`/tmp/doll-${mobile?'mobile':'desktop'}.png`,fullPage:true});
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForTimeout(500);
  const installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);
  const manifest=await page.evaluate(async()=>await(await fetch('/manifest.webmanifest')).json());assert.equal(manifest.display,'standalone');assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
  const cache=await page.evaluate(async()=>{const keys=await caches.keys();const c=await caches.open('bhargavi-shell-v9');return{keys,urls:(await c.keys()).map(r=>new URL(r.url).pathname)};});assert.ok(cache.urls.includes('/app.js'));assert.ok(cache.urls.includes('/styles.css'));
  await context.setOffline(true);await page.reload();await click('#playBtn');await tabs();await rub(180,225);assert.equal(await page.locator('#lipPaint path').count(),1);await context.setOffline(false);
  assert.deepEqual(errors,[]);
  results.push({profile:mobile?'360x800 Chromium touch emulation':'1100x900 desktop',regression:'20-step PASS',allItems:'PASS',invalidDrops:'PASS',cancelAndTabRecovery:'PASS',soundControls:'PASS',offlineShell:'PASS',installability:installability.installabilityErrors,consoleErrors:errors,horizontalOverflow:false});
  await browser.close();
 }
 console.log(JSON.stringify({url,results},null,2));
})().catch(e=>{console.error(e);process.exit(1);});
