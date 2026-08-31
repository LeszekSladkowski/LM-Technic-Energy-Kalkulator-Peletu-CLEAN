/* L&M Technic Energy — V31.3.13 CRM DAILY LIVE
   Zdalny feed: contractors-eu.json + assistant-messages.json + market-intel.json.
   Zasada bezpieczeństwa: feed uzupełnia dane źródłowe, ale nie nadpisuje lokalnej ceny kontraktowej,
   statusu CRM ani historii wypracowanej przez użytkownika. */
(function(){
'use strict';
const LM_MARKET_URL='./market-intel.json';
const LM_MARKET_KEY='lm_market_intel_cache_v1';
const LM_FEED_SYNC_KEY='lm_crm_feed_last_sync_v1';
let lmFeedBusy=false;
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function num(v){const n=Number(String(v??'').replace(',','.').replace(/\s/g,''));return Number.isFinite(n)?n:0}
function money(n){return Number(n||0).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' PLN'}
function countryName(code){return ({PL:'Polska',DE:'Niemcy',CZ:'Czechy',SK:'Słowacja',AT:'Austria',CH:'Szwajcaria',LT:'Litwa',IT:'Włochy',FR:'Francja',NL:'Holandia',BE:'Belgia',DK:'Dania'})[code]||code||''}
function getMarket(){try{return JSON.parse(localStorage.getItem(LM_MARKET_KEY)||'null')}catch(e){return null}}
async function loadMarket(force=false){
  try{
    const r=await fetch(LM_MARKET_URL+'?ts='+(force?Date.now():Math.floor(Date.now()/900000)),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();
    if(!Array.isArray(d.benchmarks))throw new Error('format');localStorage.setItem(LM_MARKET_KEY,JSON.stringify(d));return d;
  }catch(e){return getMarket()}
}
function feedToSupplier(x,old){
  const s=old||{};
  const fresh={
    id:s.id||('eu_'+x.id),euSourceId:x.id,name:x.company||s.name||'Kontrahent',
    type:x.supplier_kind||x.product||s.type||'Dostawca pelletu',source:x.source||s.source||'Rynki Europy / feed LIVE',
    cert:x.cert||s.cert||'DO WERYFIKACJI',certId:x.cert_id||s.certId||'',certStatus:s.certStatus||'DO WERYFIKACJI',
    country:countryName(x.country),city:x.city||s.city||'',postal:x.postal||s.postal||'',address:x.address||s.address||'',
    nip:x.nip||s.nip||'',regon:x.regon||s.regon||'',krs:x.krs||s.krs||'',contact:x.contact_person||s.contact||'',
    phone:x.phone||s.phone||'',mobile:x.mobile||s.mobile||'',email:x.email||s.email||'',www:x.website||s.www||'',
    minQty:x.min_qty||s.minQty||'26 t — 1 samochód',incoterm:x.incoterm||s.incoterm||'Do ustalenia',
    payment:x.payment||s.payment||'Do ustalenia',availability:x.availability||s.availability||'Brak danych / do ustalenia',
    goal:x.follow_up||s.goal||'Pozyskanie oferty zakupu',crmStage:x.crm_stage||s.crmStage||'',priorityLabel:x.priority_label||s.priorityLabel||'',
    feedUpdatedAt:x.date_updated||new Date().toISOString(),feedVersion:(window.EU31_STATE&&EU31_STATE.db&&EU31_STATE.db.version)||'',
    notes:x.note||s.notes||'',created:s.created||new Date().toISOString(),updated:s.updated||new Date().toISOString(),
    history:Array.isArray(s.history)?s.history:[]
  };
  // Pola negocjacyjne i lokalne decyzje pozostają nadrzędne.
  fresh.priority=s.priority||String(x.priority||'3');
  fresh.status=s.status||'DO KONTAKTU';
  fresh.priceStart=s.priceStart||String(x.public_price_pln_t||'');
  fresh.price=s.price||String(x.contract_price_pln_t||'');
  fresh.currency=s.currency||(x.country==='PL'?'PLN':'EUR');
  fresh.transportBy=s.transportBy||'Do ustalenia';fresh.regular=s.regular||'DO USTALENIA';
  fresh.last=s.last||'';fresh.next=s.next||'';fresh.channel=s.channel||'E-mail';
  return {...s,...fresh};
}
function mergeSupplierFeed(db){
  if(!db||!Array.isArray(db.contractors)||typeof window.getCustomSuppliers!=='function')return 0;
  const incoming=db.contractors.filter(x=>x&&x.type==='supplier'&&x.auto_import_supplier===true);
  if(!incoming.length)return 0;
  const a=window.getCustomSuppliers();let changed=0;
  for(const x of incoming){
    let i=a.findIndex(s=>String(s.euSourceId||'')===String(x.id)||String(s.id||'')==='eu_'+String(x.id));
    if(i<0)i=a.findIndex(s=>norm(s.name)===norm(x.company));
    if(i<0){const n=feedToSupplier(x,null);n.history.push({at:new Date().toISOString(),type:'FEED LIVE',text:'Automatycznie dodano z dziennej bazy L&M: '+(x.source||'feed')});a.unshift(n);changed++;}
    else{
      const before=JSON.stringify(a[i]);a[i]=feedToSupplier(x,a[i]);if(JSON.stringify(a[i])!==before)changed++;
    }
  }
  if(changed&&typeof window.saveCustomSuppliers==='function')window.saveCustomSuppliers(a);
  return changed;
}
async function refresh(force=false){
  if(lmFeedBusy)return;lmFeedBusy=true;
  try{
    let db=null;
    if(typeof window.eu31Load==='function')db=await window.eu31Load(force);
    else {const r=await fetch('./contractors-eu.json?ts='+Date.now(),{cache:'no-store'});if(r.ok)db=await r.json()}
    const changed=mergeSupplierFeed(db);await loadMarket(force);
    localStorage.setItem(LM_FEED_SYNC_KEY,new Date().toISOString());
    if(changed&&document.getElementById('supV10')&&typeof window.renderSuppliersV10==='function')window.renderSuppliersV10();
    renderBenchmark();renderNegotiation();
  }catch(e){console.warn('CRM LIVE',e)}finally{lmFeedBusy=false}
}
function selectedSupplier(){try{return typeof window.getSelectedSupplier==='function'?window.getSelectedSupplier():null}catch(e){return null}}
function supplierDiffHtml(x){
  const pub=num(x&&x.priceStart),con=num(x&&x.price);if(!(pub>0&&con>0))return '';
  const d=pub-con,pct=pub?d/pub*100:0,one=d*26;
  const cls=d>=0?'good':'bad',verb=d>=0?'OSZCZĘDNOŚĆ / WYNIK NEGOCJACJI':'CENA KONTRAKTOWA POWYŻEJ PUBLICZNEJ';
  return `<div class="card lm-neg-card ${cls}"><div class="sec" style="margin-top:0">RÓŻNICA: CENA PUBLICZNA → KONTRAKTOWA</div><div class="lm-neg-line"><b>${verb}</b></div><div class="lm-neg-grid"><span>PLN/t<b>${money(d)}</b></span><span>Różnica %<b>${pct.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})}%</b></span><span>1 samochód / 26 t<b>${money(one)}</b></span><span>5 aut / miesiąc<b>${money(one*5)}</b></span><span>10 aut / miesiąc<b>${money(one*10)}</b></span></div></div>`;
}
function injectSupplierNegotiation(){
  const root=document.getElementById('supV10');if(!root)return;const x=selectedSupplier();if(!x)return;
  const col=root.querySelector('#supDetailV10 .detail-col:nth-child(2)');if(!col||col.querySelector('.lm-neg-card'))return;
  const h=supplierDiffHtml(x);if(h){const notes=col.querySelector('.notes');if(notes)notes.insertAdjacentHTML('beforebegin',h);else col.insertAdjacentHTML('beforeend',h)}
  const firm=col.querySelector('.card:nth-child(2) .sec');if(firm)firm.textContent='CENA KONTRAKTOWA / PO NEGOCJACJI';
}
function renderBenchmark(){
  const el=document.getElementById('vc_market_benchmark');if(!el)return;const d=getMarket(),b=d&&d.benchmarks&&d.benchmarks[0];
  if(!b){el.innerHTML='<b>BENCHMARK RYNKOWY:</b> brak danych LIVE.';return}
  const pp=b.public_price||{},dv=b.derived||{};
  el.innerHTML=`<b>BENCHMARK ${String(b.scope||'').replace(/</g,'&lt;')} — ${String(b.date||'').replace(/</g,'&lt;')}</b><br>${String(b.company||'').replace(/</g,'&lt;')}: ${Number(pp.amount||0).toLocaleString('pl-PL',{minimumFractionDigits:2})} ${pp.currency||'PLN'} brutto / ${pp.pallet_kg||'—'} kg ≈ <strong>${Number(dv.gross_pln_t||0).toLocaleString('pl-PL',{minimumFractionDigits:2})} PLN/t brutto</strong>.<br><small>Cena publiczna — nie traktować jako ceny pełnego samochodu. Producent, ENplus ID i cena auta wymagają potwierdzenia.</small>`;
}
function renderNegotiation(){
  const box=document.getElementById('vc_negotiation');if(!box)return;
  const pub=num(document.getElementById('vc_public')?.value),con=num(document.getElementById('vc_purchase')?.value),qty=num(document.getElementById('vc_qty')?.value)||26;
  if(!(pub>0&&con>0)){box.innerHTML='<div class="lm-neg-empty">Wpisz CENĘ PUBLICZNĄ/WYJŚCIOWĄ i CENĘ KONTRAKTOWĄ, aby policzyć jakość negocjacji.</div>';return}
  const d=pub-con,pct=pub?d/pub*100:0,truck=d*26,month=d*qty,trucks=qty/26,cls=d>=0?'good':'bad';
  box.innerHTML=`<div class="lm-calc-neg ${cls}"><h4>RÓŻNICA: CENA PUBLICZNA → CENA KONTRAKTOWA</h4><div class="lm-calc-neg-grid"><div>PLN / t<b>${money(d)}</b></div><div>Różnica %<b>${pct.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})}%</b></div><div>PLN / samochód 26 t<b>${money(truck)}</b></div><div>PLN / miesiąc (${trucks.toLocaleString('pl-PL',{maximumFractionDigits:0})} aut)<b>${money(month)}</b></div></div></div>`;
}
function injectCalculator(){
  const screen=document.querySelector('.v15-screen');if(!screen||document.getElementById('vc_public'))return;
  const purchase=document.getElementById('vc_purchase');if(!purchase)return;
  const field=purchase.closest('.v15-field');const s=selectedSupplier();const cached=JSON.parse(localStorage.getItem('lm_calc_v15')||'{}');
  const pub=cached.publicPrice||num(s&&s.priceStart)||'';
  const extra=document.createElement('div');extra.className='v15-field lm-public-field';extra.innerHTML=`<label>Cena publiczna / wyjściowa netto [PLN/t] — do porównania</label><input id="vc_public" class="v15-input" type="number" step="0.01" value="${pub}"><small>${s?'Wybrany dostawca: '+String(s.name||''):'Pole opcjonalne — służy wyłącznie do oceny negocjacji.'}</small>`;
  field.parentElement.insertBefore(extra,field);
  const result=document.getElementById('vc_result');if(result){const neg=document.createElement('div');neg.id='vc_negotiation';neg.className='lm-negotiation-wrap';result.insertAdjacentElement('afterend',neg);const bm=document.createElement('div');bm.id='vc_market_benchmark';bm.className='lm-market-benchmark';neg.insertAdjacentElement('afterend',bm)}
  const savePublic=()=>{try{const x=JSON.parse(localStorage.getItem('lm_calc_v15')||'{}');x.publicPrice=num(document.getElementById('vc_public')?.value);localStorage.setItem('lm_calc_v15',JSON.stringify(x))}catch(e){}renderNegotiation()};
  ['vc_public','vc_purchase','vc_qty'].forEach(id=>document.getElementById(id)?.addEventListener('input',savePublic));
  ['vc_public','vc_purchase','vc_qty'].forEach(id=>document.getElementById(id)?.addEventListener('change',savePublic));
  renderNegotiation();renderBenchmark();
}
function wrap(name,after){const orig=window[name];if(typeof orig!=='function'||orig.__lmLiveWrapped)return;const w=function(){const r=orig.apply(this,arguments);try{after()}catch(e){}return r};w.__lmLiveWrapped=true;window[name]=w}
wrap('renderSuppliersV10',injectSupplierNegotiation);
wrap('renderSupplierMasterPage',()=>{injectSupplierNegotiation();setTimeout(()=>refresh(false),30)});
wrap('renderCalculatorV15',()=>{injectCalculator();setTimeout(()=>loadMarket(false).then(renderBenchmark),20)});
wrap('openSupplierForm',()=>{setTimeout(()=>{const n=document.querySelector('label[for="sf_price_start"]');if(n)n.textContent='Cena publiczna / wyjściowa netto / t';const input=document.getElementById('sf_price_start');if(input&&input.previousElementSibling)input.previousElementSibling.textContent='Cena publiczna / wyjściowa netto / t';},0)});
window.lmRefreshRemoteCRM=refresh;window.lmLoadMarketIntel=loadMarket;
window.addEventListener('online',()=>refresh(true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh(false)});
setInterval(()=>refresh(true),15*60*1000);
setTimeout(()=>refresh(true),450);
})();

/* V31.3.38 — R38 LIVE STATS HOTFIX
   RYNKI EU: statystyki na KARCIE 1 odświeżają się po synchronizacji i zmianach CRM.
   Brak zmian CSS, proporcji, grafiki i elementów MASTER. */
(function(){
'use strict';
let r38Queued=false;
function list(v){return Array.isArray(v)?v:[]}
function marketCode(rec){
  try{return typeof window.euMarketCountryCodeFromRecord==='function'?window.euMarketCountryCodeFromRecord(rec):''}catch(e){return ''}
}
function counts(){
  let countries=0,suppliers=0,clients=0,offers=0,allClients=[];
  try{
    if(typeof window.euMarketsGetActiveCountries==='function')countries=list(window.euMarketsGetActiveCountries()).length;
    else countries=document.querySelectorAll('.eu31-overview-page .eu31-country').length;
    const allSuppliers=typeof window.normNewSuppliers==='function'?list(window.normNewSuppliers()):(typeof window.loadSuppliers==='function'?list(window.loadSuppliers()):[]);
    allClients=typeof window.normalizeClients==='function'?list(window.normalizeClients()):(typeof window.loadClients==='function'?list(window.loadClients()):[]);
    suppliers=allSuppliers.filter(s=>!!marketCode(s)).length;
    clients=allClients.filter(c=>!!marketCode(c)).length;
    const allOffers=typeof window.loadOffers==='function'?list(window.loadOffers()):[];
    offers=allOffers.filter(o=>{
      if(!o)return false;
      if(marketCode(o))return true;
      const cid=String(o.clientId||'');
      if(!cid)return false;
      return allClients.some(c=>c&&String(c.id)===cid&&!!marketCode(c));
    }).length;
  }catch(e){console.warn('R38 LIVE STATS',e)}
  return [countries,suppliers,clients,offers];
}
function refreshMarketStats(){
  const page=document.querySelector('.eu31-overview-page');if(!page)return;
  const nodes=[...page.querySelectorAll('.eu31-summary .eu31-stat b')];if(nodes.length<4)return;
  const values=counts();
  values.forEach((v,i)=>{const next=String(v);if(nodes[i]&&nodes[i].textContent!==next)nodes[i].textContent=next});
  const btn=page.querySelector('#eu31-sync-btn');
  if(btn&&!btn.dataset.r38LiveStats){
    btn.dataset.r38LiveStats='1';
    btn.addEventListener('click',()=>[0,250,750,1500,3000,6000].forEach(ms=>setTimeout(refreshMarketStats,ms)));
  }
}
function queueR38(){
  if(r38Queued)return;r38Queued=true;
  requestAnimationFrame(()=>{r38Queued=false;refreshMarketStats()});
}
const app=document.getElementById('app');
if(app)new MutationObserver(queueR38).observe(app,{childList:true,subtree:true});
window.addEventListener('storage',queueR38);
window.addEventListener('pageshow',queueR38);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queueR38()});
window.r38RefreshMarketStats=refreshMarketStats;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueR38,{once:true});else queueR38();
})();
