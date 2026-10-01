'use strict';
const CACHE='bhargavi-shell-v10';
const SHELL=['/','/index.html','/app.js?v=10','/styles.css?v=10','/manifest.webmanifest?v=10','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('bhargavi')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {
   const response=await fetch(request,{cache:'no-store'});
   if(response.ok) await cache.put(request,response.clone());
   return response;
  } catch {
   const cached=await cache.match(request);
   if(cached)return cached;
   if(request.mode==='navigate')return (await cache.match('/'));
   return Response.error();
  }
 })());
});
