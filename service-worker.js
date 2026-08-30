const APP_VERSION='V31.3.38-REPO-CLEAN-MAGAZYN-RESET';
const PUBLIC_VERSION='V31.3.38';
const CACHE='lm-technic-energy-'+APP_VERSION;
const PREFIX='lm-technic-energy-';

// V31.3.37 — MAGAZYN MASTER CANVAS LIVE — chirurgiczne pola LIVE bez widocznych prostokątnych nakładek; PRODUKCJA MASTER V31.3.31 pozostaje bez zmian
// KLUCZOWA ZASADA: install NIE wywołuje skipWaiting() i NIE pobiera ciężkich plików.
// Stary updater V31.3.25 oczekuje, że nowy worker najpierw przejdzie do stanu WAITING,
// a dopiero potem wysyła mu komunikat SKIP_WAITING. Poprzedni build aktywował się zbyt szybko,
// przez co updater potrafił przegapić stan WAITING i zatrzymywał się przy 52%.
self.addEventListener('install',event=>{
  event.waitUntil(Promise.resolve());
});

self.addEventListener('message',event=>{
  const d=event.data||{};
  if(d.type==='SKIP_WAITING'){
    event.waitUntil(self.skipWaiting());
    return;
  }
  if(d.type==='GET_VERSION'){
    try{event.source&&event.source.postMessage({type:'SW_VERSION',version:PUBLIC_VERSION,cache:CACHE});}catch(e){}
    return;
  }
  if(d.type==='WARM_MASTER_ASSETS'){
    event.waitUntil(warmCurrentAssets());
  }
});

self.addEventListener('activate',event=>{
  // Przejęcie klientów ma być natychmiastowe. Nie czekamy tu na grafiki ani stare cache.
  event.waitUntil((async()=>{
    if(self.registration.navigationPreload){try{await self.registration.navigationPreload.enable();}catch(e){}}
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of clients){
      try{c.postMessage({type:'VERSION_ACTIVATED',version:PUBLIC_VERSION,cache:CACHE});}catch(e){}
    }
  })());
});

const CURRENT_ASSETS=[
  './index.html',
  './app-main.js',
  './version.json',
  './rynki-eu-update-v31328.json',
  './live-dashboard-v31329.js',
  './live-dashboard-v31329.css',
  './production-master-v31331.js',
  './production-master-v31331.css',
  './MASTER_PRODUKCJA_KARTA_1_V31330.png',
  './MASTER_PRODUKCJA_KARTA_2_V31330.png',
  './MASTER_PRODUKCJA_KARTA_3_V31330.png',
  './MASTER_PRODUKCJA_KARTA_4_V31330.png',
  './MASTER_PRODUKCJA_KARTA_5_V31330.png',
  './LIVE_TEMPLATE_PRODUKCJA_KARTA_1_V31331.png',
  './LIVE_TEMPLATE_PRODUKCJA_KARTA_2_V31331.png',
  './LIVE_TEMPLATE_PRODUKCJA_KARTA_3_V31331.png',
  './LIVE_TEMPLATE_PRODUKCJA_KARTA_4_V31331.png',
  './LIVE_TEMPLATE_PRODUKCJA_KARTA_5_V31331.png',
  './warehouse-reset-v31338.css',
  './warehouse-reset-v31338.js',
  './MASTER_PULPIT_MASTER.png'
];

function abs(path){return new URL(path,self.registration.scope).toString();}
async function cacheCurrent(path,response){
  try{const c=await caches.open(CACHE);await c.put(path,response.clone());}catch(e){}
}
async function fetchNetwork(path,request){
  const target=request||abs(path);
  const r=await fetch(target,{cache:'no-store',redirect:'follow'});
  if(r&&r.ok)await cacheCurrent(path,r);
  return r;
}
async function currentHit(pathOrReq){
  try{return await (await caches.open(CACHE)).match(pathOrReq);}catch(e){return null;}
}
async function oldHit(pathOrReq){
  const keys=(await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE).reverse();
  for(const k of keys){
    try{const hit=await (await caches.open(k)).match(pathOrReq);if(hit)return hit;}catch(e){}
  }
  return null;
}
async function networkFirst(path,request){
  try{
    const r=await fetchNetwork(path,request);
    if(r&&r.ok)return r;
  }catch(e){}
  return (await currentHit(path))||(await oldHit(path))||(await oldHit(request))||Response.error();
}
async function cacheFallback(path,request){
  const cur=await currentHit(path||request);
  if(cur)return cur;
  try{
    const r=await fetchNetwork(path||request,request);
    if(r&&r.ok)return r;
  }catch(e){}
  return (await oldHit(path||request))||(await oldHit(request))||Response.error();
}
async function warmCurrentAssets(){
  await Promise.allSettled(CURRENT_ASSETS.map(async p=>{
    const hit=await currentHit(p);
    if(!hit)await fetchNetwork(p);
  }));
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const p=url.pathname;

  if(/\/version\.json$/.test(p)){event.respondWith(networkFirst('./version.json',req));return;}
  if(req.mode==='navigate'){event.respondWith(networkFirst('./index.html',req));return;}
  if(/\/app-main\.js$/.test(p)){event.respondWith(networkFirst('./app-main.js',req));return;}
  if(/\/live-dashboard-v31329\.js$/.test(p)){event.respondWith(networkFirst('./live-dashboard-v31329.js',req));return;}
  if(/\/live-dashboard-v31329\.css$/.test(p)){event.respondWith(networkFirst('./live-dashboard-v31329.css',req));return;}
  if(/\/production-master-v31331\.js$/.test(p)){event.respondWith(networkFirst('./production-master-v31331.js',req));return;}
  if(/\/production-master-v31331\.css$/.test(p)){event.respondWith(networkFirst('./production-master-v31331.css',req));return;}
  const prodMaster=p.match(/\/(MASTER_PRODUKCJA_KARTA_[1-5]_V31330\.png)$/);
  if(prodMaster){event.respondWith(networkFirst('./'+prodMaster[1],req));return;}
  const prodTemplate=p.match(/\/(LIVE_TEMPLATE_PRODUKCJA_KARTA_[1-5]_V31331\.png)$/);
  if(prodTemplate){event.respondWith(networkFirst('./'+prodTemplate[1],req));return;}
  if(/\/warehouse-reset-v31338\.js$/.test(p)){event.respondWith(networkFirst('./warehouse-reset-v31338.js',req));return;}
  if(/\/warehouse-reset-v31338\.css$/.test(p)){event.respondWith(networkFirst('./warehouse-reset-v31338.css',req));return;}
  if(/\/MASTER_PULPIT_MASTER\.png$/.test(p)){event.respondWith(networkFirst('./MASTER_PULPIT_MASTER.png',req));return;}

  const live=['contractors-eu.json','rynki-eu-update-v31328.json','assistant-messages.json','market-intel.json','backup-catalog.json'];
  for(const name of live){if(p.endsWith('/'+name)){event.respondWith(networkFirst('./'+name,req));return;}}

  event.respondWith(cacheFallback(req,req));
});
