(()=>{
'use strict';
const VERSION='V31.3.38';
const KEY='lm_v31338_warehouse_clean_records';
const STRETCH_KEY='lm_v31338_stretch_pallets_per_roll';
const oldGo=window.go;
const RESET_FLAG='lm_v31338_warehouse_reset_done';
if(localStorage.getItem(RESET_FLAG)!=='1'){
  ['lm_v31314_warehouse_master_records','lm_v3139_warehouse_moves','lm_v31314_stretch_pallets_per_roll','lm_v31318_warehouse_quick_pallet','lm_live_stock_snapshot_v1'].forEach(k=>localStorage.removeItem(k));
  localStorage.removeItem(KEY); localStorage.removeItem(STRETCH_KEY); localStorage.setItem(RESET_FLAG,'1');
}
const n=v=>Number(String(v??0).replace(',','.'))||0;
const round=(v,d=3)=>Math.round((n(v)+Number.EPSILON)*10**d)/10**d;
const now=()=>new Date().toISOString();
const uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
function read(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function write(a){localStorage.setItem(KEY,JSON.stringify((Array.isArray(a)?a:[]).slice(0,20000)));window.dispatchEvent(new CustomEvent('lm:warehouse-changed',{detail:{version:VERSION}}));return true}
function sign(r){return String(r.movement||'IN').toUpperCase()==='OUT'?-1:1}
function stockFor(card){const a=read().filter(r=>r.card===card);let tons=0,pallets=0,qty=0;for(const r of a){const s=sign(r);tons+=s*n(r.tons);pallets+=s*n(r.pallets);qty+=s*n(r.qty)}return {tons:round(tons),pallets:round(pallets),qty:round(qty)}}
function packagingStocks(){const out={'Worki 15 kg':0,'Paleta krajowa':0,'Europaleta (EPAL)':0,'Stretch (rolka)':0};for(const r of read().filter(x=>x.card==='pack')){if(!(r.material in out))out[r.material]=0;out[r.material]+=sign(r)*n(r.qty)}Object.keys(out).forEach(k=>out[k]=round(out[k],4));return out}
function stretchRate(){return Math.max(.1,n(localStorage.getItem(STRETCH_KEY)||10))}
function packagingPotential(){const s=packagingStocks(),rate=stretchRate();return {stocks:s,stretchRate:rate,domestic:Math.max(0,Math.floor(Math.min(n(s['Worki 15 kg'])/68,n(s['Paleta krajowa']),n(s['Stretch (rolka)'])*rate))),epal:Math.max(0,Math.floor(Math.min(n(s['Worki 15 kg'])/68,n(s['Europaleta (EPAL)']),n(s['Stretch (rolka)'])*rate)))}}
function produceBigbags(qty,date,batch){qty=Math.floor(n(qty));if(qty<=0)return {ok:false,message:'Podaj liczbę BIG BAG większą od 0.'};const bulk=stockFor('bulk');if(n(bulk.tons)<qty)return {ok:false,message:`Brak pelletu luzem. Potrzeba ${qty} t, stan ${round(bulk.tons)} t.`};const tx=uid('tx');const d=date||new Date().toISOString().slice(0,10);const common={transactionId:tx,date:d,time:new Date().toLocaleTimeString('pl-PL'),batch:batch||'',createdAt:now(),updatedAt:now(),sourceEntry:'PRODUCTION_MASTER'};write([{...common,id:uid('wh'),card:'bulk',movement:'OUT',movementType:'PRODUCTION_BIGBAG',material:'Pelet luzem',tons:qty,qty:0,pallets:0,unit:'t',destination:'Produkcja BIG BAG'},{...common,id:uid('wh'),card:'bigbag',movement:'IN',movementType:'PRODUCTION_BIGBAG',material:'BIG BAG 1000 kg',tons:qty,qty,pallets:0,unit:'szt.',source:'Produkcja L&M'},...read()]);return {ok:true,transactionId:tx}}
function renderReset(){
 document.documentElement.classList.add('wh-reset-open');
 const app=document.querySelector('#app'); if(!app)return;
 app.innerHTML=`<main class="wh-reset-shell"><header><button data-back>←<span>POWRÓT</span></button><div><h1>MAGAZYN</h1><p>CZYSTA GAŁĄŹ — RESET 30.08.2026</p></div><button data-home>▦<span>PULPIT</span></button></header><section class="wh-reset-card"><div class="badge">RESET ZAKOŃCZONY</div><h2>MAGAZYN GOTOWY DO PROJEKTU OD ZERA</h2><p>Usunięto stare ekrany, nakładki, historyczne hotfixy i wszystkie dane testowe MAGAZYNU.</p><div class="grid"><article><b>1</b><span>SILOS</span><small>0 t</small></article><article><b>2</b><span>PALETY 15 KG</span><small>0 t</small></article><article><b>3</b><span>BIG BAG</span><small>0 szt.</small></article><article><b>4</b><span>OPAKOWANIA</span><small>0</small></article></div><p class="note">Nowe karty i pełne tabele zostaną dodane dopiero po zatwierdzeniu grafik MASTER dla Samsung Galaxy S24 Ultra.</p></section></main>`;
 app.querySelector('[data-back]').onclick=()=>{document.documentElement.classList.remove('wh-reset-open');typeof oldGo==='function'&&oldGo('home')};
 app.querySelector('[data-home]').onclick=()=>{document.documentElement.classList.remove('wh-reset-open');typeof oldGo==='function'&&oldGo('home')};
 window.scrollTo({top:0,left:0,behavior:'auto'});
}
window.LM_WAREHOUSE_V31338={version:VERSION,load:read,save:write,stockFor,packagingStocks,packagingPotential,produceBigbags,reset(){localStorage.removeItem(KEY);localStorage.removeItem(STRETCH_KEY);write([])},setStretchRate(v){localStorage.setItem(STRETCH_KEY,String(Math.max(.1,n(v)||10)));return stretchRate()}};
window.LM_WAREHOUSE_V31321=window.LM_WAREHOUSE_V31338;
window.renderWarehouseV31338=renderReset;
window.go=function(name){if(name==='warehouse')return renderReset();document.documentElement.classList.remove('wh-reset-open');return typeof oldGo==='function'?oldGo(name):undefined};
})();
