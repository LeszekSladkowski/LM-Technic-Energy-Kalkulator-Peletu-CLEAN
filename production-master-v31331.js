/* =====================================================================
   L&M TECHNIC ENERGY — V31.3.31
   PRODUKCJA — MASTER 5 KART LIVE / CENTRALNY PRZEPŁYW DANYCH

   1. PRODUKCJA PELETU      -> automatyczne przyjęcie PELET LUZEM do MAGAZYNU
   2. PRODUKCJA BIG BAG     -> pobranie luzem + przyjęcie BIG BAG do MAGAZYNU
   3. WORKOWANY PELET 15 kg -> pobranie luzem + pustych worków; wynik jako WIP
   4. PAKOWANIE STRECZEM    -> WIP 68 worków + paleta + stretch -> paleta w MAGAZYNIE
   5. SUMA DNIA             -> jedno podsumowanie obu zmian i całego przepływu

   Bitmapy MASTER pozostają niezmienione bajt w bajt. Runtime używa chirurgicznie
   oczyszczonego szablonu LIVE pochodzącego z MASTER-a i jednej powierzchni CANVAS — bez stałych nakładek DOM. Wszystkie ruchy są zapisywane atomowo w localStorage.
   ===================================================================== */
(function(){
'use strict';

const VERSION='V31.3.31';
const KEY='lm_v31330_production_records';
const TIMER_KEY='lm_v31330_production_timers';
const OP_KEY='lm_v31330_production_operators';
const BATCH_KEY='lm_v31330_production_batch';
const BATCH_COUNTER_KEY='lm_v31330_production_batch_counter';
const SNAP_KEY='lm_live_stock_snapshot_v1';
const MASTER={
  1:'./MASTER_PRODUKCJA_KARTA_1_V31330.png?v=31.3.30',
  2:'./MASTER_PRODUKCJA_KARTA_2_V31330.png?v=31.3.30',
  3:'./MASTER_PRODUKCJA_KARTA_3_V31330.png?v=31.3.30',
  4:'./MASTER_PRODUKCJA_KARTA_4_V31330.png?v=31.3.30',
  5:'./MASTER_PRODUKCJA_KARTA_5_V31330.png?v=31.3.30'
};
const TEMPLATE={
  1:'./LIVE_TEMPLATE_PRODUKCJA_KARTA_1_V31331.png?v=31.3.31',
  2:'./LIVE_TEMPLATE_PRODUKCJA_KARTA_2_V31331.png?v=31.3.31',
  3:'./LIVE_TEMPLATE_PRODUKCJA_KARTA_3_V31331.png?v=31.3.31',
  4:'./LIVE_TEMPLATE_PRODUKCJA_KARTA_4_V31331.png?v=31.3.31',
  5:'./LIVE_TEMPLATE_PRODUKCJA_KARTA_5_V31331.png?v=31.3.31'
};
let activeCard=1, previousGo=window.go, timerTick=null, touchX=null;

function safeJSON(s,f){try{const x=JSON.parse(s);return x??f}catch(e){return f}}
function n(v){const x=Number(String(v??0).replace(',','.'));return Number.isFinite(x)?x:0}
function round(v,d=2){const p=10**d;return Math.round((n(v)+Number.EPSILON)*p)/p}
function fmt(v,d=0){return n(v).toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d})}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function pad(v,l=2){return String(v).padStart(l,'0')}
function localDate(d=new Date()){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function localDatePL(v=localDate()){const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:v}
function clock(d=new Date()){return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`}
function now(){return new Date().toISOString()}
function uid(p='prd'){return `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function load(){const a=safeJSON(localStorage.getItem(KEY)||'[]',[]);return Array.isArray(a)?a:[]}
function save(a){localStorage.setItem(KEY,JSON.stringify((Array.isArray(a)?a:[]).slice(0,20000)));writeSnapshot();window.dispatchEvent(new CustomEvent('lm:production-changed',{detail:{version:VERSION}}));window.dispatchEvent(new CustomEvent('lm:datahub-changed',{detail:snapshot()}))}
function operators(){return {...{1:'Jan Kowalski',2:'Piotr Nowakowski'},...safeJSON(localStorage.getItem(OP_KEY)||'{}',{})}}
function setOperator(shift,name){const o=operators();o[shift]=String(name||'').trim()||o[shift];localStorage.setItem(OP_KEY,JSON.stringify(o));refreshLive();writeSnapshot()}
function currentShift(){const d=new Date(),m=d.getHours()*60+d.getMinutes();return m>=14*60+45&&m<23*60+30?2:1}
function shiftWindow(s){return s===2?'15:00 - 23:00':'06:30 - 14:30'}
function records(date=localDate()){return load().filter(x=>x.date===date)}
function byCard(card,date=localDate(),shift=null){return records(date).filter(x=>x.card===card&&(shift==null||Number(x.shift)===Number(shift)))}
function sum(a,key){return a.reduce((s,x)=>s+n(x[key]),0)}
function seconds(a){return sum(a,'seconds')}
function rate(amount,secs){return secs>0?amount/(secs/3600):0}
function cardStats(card,shift,date=localDate()){
  const a=byCard(card,date,shift),sec=seconds(a);
  if(card===1){const tons=sum(a,'tons');return {count:a.length,tons,kg:tons*1000,seconds:sec,rate:rate(tons,sec)}}
  if(card===2){const qty=sum(a,'qty');return {count:a.length,qty,tons:qty,seconds:sec,rate:rate(qty,sec)}}
  if(card===3){const qty=sum(a,'qty');return {count:a.length,qty,tons:qty*.015,seconds:sec,rate:rate(qty,sec)}}
  if(card===4){const pallets=sum(a,'pallets'),bags=sum(a,'bagsConsumed'),filmKg=sum(a,'filmKg');return {count:a.length,pallets,bags,tons:pallets*1.02,filmKg,seconds:sec,rate:rate(pallets,sec)}}
  return {count:0,seconds:0,rate:0};
}
function totalStats(card,date=localDate()){
  const a=byCard(card,date,null),sec=seconds(a);
  if(card===1){const tons=sum(a,'tons');return {count:a.length,tons,kg:tons*1000,seconds:sec,rate:rate(tons,sec)}}
  if(card===2){const qty=sum(a,'qty');return {count:a.length,qty,tons:qty,seconds:sec,rate:rate(qty,sec)}}
  if(card===3){const qty=sum(a,'qty');return {count:a.length,qty,tons:qty*.015,seconds:sec,rate:rate(qty,sec)}}
  if(card===4){const pallets=sum(a,'pallets'),bags=sum(a,'bagsConsumed'),filmKg=sum(a,'filmKg');return {count:a.length,pallets,bags,tons:pallets*1.02,filmKg,seconds:sec,rate:rate(pallets,sec)}}
  return {};
}
function allWipBags(){const a=load();return Math.max(0,Math.round(sum(a.filter(x=>x.card===3),'qty')-sum(a.filter(x=>x.card===4),'bagsConsumed')))}
function wh(){return window.LM_WAREHOUSE_V31321||null}
function whState(){const W=wh();if(!W)return {ready:false,bulk:{tons:0},pallet:{pallets:0,tons:0,qty:0},bigbag:{qty:0,tons:0},pack:{},stretchRate:10};try{const p=W.packagingPotential();return {ready:true,bulk:W.stockFor('bulk'),pallet:W.stockFor('pallet'),bigbag:W.stockFor('bigbag'),pack:W.packagingStocks(),stretchRate:n(p.stretchRate)||10}}catch(e){return {ready:false,bulk:{tons:0},pallet:{pallets:0,tons:0,qty:0},bigbag:{qty:0,tons:0},pack:{},stretchRate:10}}}
function whRecord(base){return {id:uid('whprd'),transactionId:base.transactionId||uid('tx'),card:base.card,date:base.date||localDate(),time:base.time||clock(),movement:base.movement||'IN',movementType:base.movementType||'PRODUCTION_MASTER',warehouse:base.card,material:base.material||'',supplier:base.supplier||'',supplierId:'',source:base.source||'Produkcja L&M',client:'',clientId:'',receiver:'',batch:base.batch||'',tons:n(base.tons),pallets:n(base.pallets),qty:n(base.qty),unit:base.unit||'',net:0,vat:23,gross:0,invoice:'',transport:0,market:'Polska',country:'Polska',city:'',exportEU:false,destination:base.destination||'',notes:base.notes||`Automatyczny ruch z gałęzi PRODUKCJA ${VERSION}`,sourceEntry:'PRODUCTION_MASTER',createdAt:now(),updatedAt:now()}}
function whCommit(recs){const W=wh();if(!W||typeof W.load!=='function'||typeof W.save!=='function')return {ok:false,message:'Moduł MAGAZYN nie jest jeszcze gotowy. Otwórz raz MAGAZYN i wróć do PRODUKCJI.'};try{W.save([...recs,...W.load()]);return {ok:true}}catch(e){return {ok:false,message:'Nie udało się zapisać ruchu w MAGAZYNIE.'}}}
function prodRecord(card,shift,data={}){return {id:uid('prod'),card,shift:Number(shift)||currentShift(),operator:operators()[shift]||'',date:data.date||localDate(),time:data.time||clock(),createdAt:now(),batch:data.batch||currentBatch(),seconds:n(data.seconds),tons:n(data.tons),qty:n(data.qty),pallets:n(data.pallets),bagsConsumed:n(data.bagsConsumed),filmKg:n(data.filmKg),warehouseTransactionId:data.warehouseTransactionId||'',notes:data.notes||''}}

function commitBulk({tons,shift,batch,seconds:sec=0}){
  tons=round(tons,3);if(tons<=0)return {ok:false,message:'Podaj ilość wyprodukowanego pelletu większą od 0 t.'};const tx=uid('bulkprod');const wr=whRecord({transactionId:tx,card:'bulk',movement:'IN',movementType:'PRODUCTION_BULK',material:'Pelet luzem',tons,unit:'t',batch,source:'Produkcja L&M',supplier:'Produkcja L&M',destination:'Silos / magazyn pelletu luzem',notes:`Produkcja pelletu ${fmt(tons,3)} t — automatyczne przyjęcie do magazynu.`});const w=whCommit([wr]);if(!w.ok)return w;const r=prodRecord(1,shift,{tons,batch,seconds:sec,warehouseTransactionId:tx});save([r,...load()]);return {ok:true,record:r,message:`Zapisano ${fmt(tons,3)} t. MAGAZYN pelletu luzem został zaktualizowany.`}}
function commitBigbag({qty,shift,batch,seconds:sec=0}){
  qty=Math.floor(n(qty));if(qty<=0)return {ok:false,message:'Podaj liczbę BIG BAG większą od 0.'};const W=wh();if(!W||typeof W.produceBigbags!=='function')return {ok:false,message:'Moduł MAGAZYN nie jest gotowy.'};const res=W.produceBigbags(qty,localDate(),batch);if(!res.ok)return res;const r=prodRecord(2,shift,{qty,tons:qty,batch,seconds:sec,warehouseTransactionId:res.transactionId});save([r,...load()]);return {ok:true,record:r,message:`Wyprodukowano ${qty} BIG BAG. Pellet luzem został pobrany, a BIG BAG przyjęte do MAGAZYNU.`}}
function commitBags({qty,shift,batch,seconds:sec=0}){
  qty=Math.floor(n(qty));if(qty<=0)return {ok:false,message:'Podaj liczbę worków większą od 0.'};const W=wh(),s=whState();if(!W||!s.ready)return {ok:false,message:'Moduł MAGAZYN nie jest gotowy.'};const tons=round(qty*.015,3),bags=n(s.pack['Worki 15 kg']);const missing=[];if(n(s.bulk.tons)+1e-9<tons)missing.push(`pellet luzem: potrzeba ${fmt(tons,3)} t, jest ${fmt(s.bulk.tons,3)} t`);if(bags+1e-9<qty)missing.push(`puste worki 15 kg: potrzeba ${qty} szt., jest ${fmt(bags,0)} szt.`);if(missing.length)return {ok:false,message:'Brak materiałów:\n'+missing.join('\n')};const tx=uid('bagprod'),common={transactionId:tx,batch};const wr=[whRecord({...common,card:'bulk',movement:'OUT',movementType:'PRODUCTION_15KG_WIP',material:'Pelet luzem',tons,unit:'t',destination:'Produkcja worków 15 kg'}),whRecord({...common,card:'pack',movement:'OUT',movementType:'PRODUCTION_15KG_WIP',material:'Worki 15 kg',qty,unit:'szt.',destination:'Produkcja worków 15 kg'})];const w=whCommit(wr);if(!w.ok)return w;const r=prodRecord(3,shift,{qty,tons,batch,seconds:sec,warehouseTransactionId:tx});save([r,...load()]);return {ok:true,record:r,message:`Wyprodukowano ${qty} worków 15 kg (${fmt(tons,3)} t). Worki czekają na pakowanie streczem.`}}
function commitStretch({pallets,palletType='Paleta krajowa',filmKg,shift,batch,seconds:sec=0}){
  pallets=Math.floor(n(pallets));if(pallets<=0)return {ok:false,message:'Podaj liczbę palet większą od 0.'};if(!['Paleta krajowa','Europaleta (EPAL)'].includes(palletType))palletType='Paleta krajowa';const W=wh(),s=whState();if(!W||!s.ready)return {ok:false,message:'Moduł MAGAZYN nie jest gotowy.'};const bagsNeed=pallets*68,wip=allWipBags(),rateStretch=Math.max(.1,n(s.stretchRate)||10),rolls=round(pallets/rateStretch,4),palAvail=n(s.pack[palletType]),stAvail=n(s.pack['Stretch (rolka)']);const missing=[];if(wip<bagsNeed)missing.push(`napełnione worki WIP: potrzeba ${bagsNeed}, jest ${wip}`);if(palAvail<pallets)missing.push(`${palletType}: potrzeba ${pallets}, jest ${fmt(palAvail,0)}`);if(stAvail+1e-9<rolls)missing.push(`stretch: potrzeba ${fmt(rolls,2)} rol., jest ${fmt(stAvail,2)} rol.`);if(missing.length)return {ok:false,message:'Brak materiałów:\n'+missing.join('\n')};filmKg=n(filmKg)>0?round(filmKg,2):round(pallets*.20,2);const tx=uid('stretchprod'),tons=round(pallets*1.02,2),common={transactionId:tx,batch};const wr=[whRecord({...common,card:'pack',movement:'OUT',movementType:'STRETCH_PACKING',material:palletType,qty:pallets,unit:'szt.',destination:'Pakowanie streczem'}),whRecord({...common,card:'pack',movement:'OUT',movementType:'STRETCH_PACKING',material:'Stretch (rolka)',qty:rolls,unit:'rolka',destination:'Pakowanie streczem'}),whRecord({...common,card:'pallet',movement:'IN',movementType:'STRETCH_PACKING',material:'Pellet 15 kg na paletach',tons,pallets,qty:bagsNeed,unit:'paleta',source:'Produkcja L&M',supplier:'Produkcja L&M',destination:'Magazyn palet 15 kg',notes:`Pakowanie streczem: ${pallets} palet / ${bagsNeed} worków / ${fmt(filmKg,2)} kg folii.`})];const w=whCommit(wr);if(!w.ok)return w;const r=prodRecord(4,shift,{pallets,bagsConsumed:bagsNeed,tons,filmKg,batch,seconds:sec,warehouseTransactionId:tx});save([r,...load()]);return {ok:true,record:r,message:`Zapakowano ${pallets} palet. Gotowe palety zostały przyjęte do MAGAZYNU.`}}

function timerState(){return safeJSON(localStorage.getItem(TIMER_KEY)||'{}',{})}
function timerId(card,shift){return `${card}_${shift}`}
function timerSeconds(card,shift){const s=timerState()[timerId(card,shift)]||{accumulated:0,running:false};return n(s.accumulated)+(s.running&&s.startedAt?Math.max(0,(Date.now()-n(s.startedAt))/1000):0)}
function startTimer(card,shift=currentShift()){
  if(card>4)return;const all=timerState(),k=timerId(card,shift),s=all[k]||{accumulated:0,running:false};if(s.running){flash('Czas tej maszyny już jest liczony.');return}s.running=true;s.startedAt=Date.now();all[k]=s;localStorage.setItem(TIMER_KEY,JSON.stringify(all));flash(`START — karta ${card}/5, ${shift===1?'I':'II'} zmiana.`);refreshLive()
}
function stopTimer(card,shift=currentShift()){
  if(card>4)return 0;const all=timerState(),k=timerId(card,shift),s=all[k]||{accumulated:0,running:false};if(s.running&&s.startedAt)s.accumulated=n(s.accumulated)+(Date.now()-n(s.startedAt))/1000;s.running=false;s.startedAt=0;all[k]=s;localStorage.setItem(TIMER_KEY,JSON.stringify(all));refreshLive();return n(s.accumulated)
}
function resetTimer(card,shift){const all=timerState(),k=timerId(card,shift);all[k]={accumulated:0,running:false,startedAt:0};localStorage.setItem(TIMER_KEY,JSON.stringify(all));refreshLive()}
function hhmmss(sec){sec=Math.max(0,Math.floor(n(sec)));return `${pad(Math.floor(sec/3600))}:${pad(Math.floor((sec%3600)/60))}:${pad(sec%60)}`}

function batchBase(){const d=new Date();return `P${pad(d.getDate())}${pad(d.getMonth()+1)}${d.getFullYear()}`}
function generateBatch(){const base=batchBase(),old=safeJSON(localStorage.getItem(BATCH_COUNTER_KEY)||'{}',{}),num=n(old.base===base?old.num:0)+1;localStorage.setItem(BATCH_COUNTER_KEY,JSON.stringify({base,num}));const b=`${base}-${pad(num,3)}`;localStorage.setItem(BATCH_KEY,b);refreshLive();flash('Wygenerowano nową partię: '+b);return b}
function currentBatch(){let b=localStorage.getItem(BATCH_KEY)||'';if(!b){const base=batchBase(),old=safeJSON(localStorage.getItem(BATCH_COUNTER_KEY)||'{}',{}),num=n(old.base===base?old.num:0)+1;localStorage.setItem(BATCH_COUNTER_KEY,JSON.stringify({base,num}));b=`${base}-${pad(num,3)}`;localStorage.setItem(BATCH_KEY,b)}return b}

function snapshot(){const date=localDate(),s1={1:cardStats(1,1,date),2:cardStats(2,1,date),3:cardStats(3,1,date),4:cardStats(4,1,date)},s2={1:cardStats(1,2,date),2:cardStats(2,2,date),3:cardStats(3,2,date),4:cardStats(4,2,date)},tot={1:totalStats(1,date),2:totalStats(2,date),3:totalStats(3,date),4:totalStats(4,date)},warehouse=whState();return {schema:'LM_DATA_HUB_V1',version:VERSION,generatedAt:now(),date,operators:operators(),production:{shift1:s1,shift2:s2,total:tot,wipBags:allWipBags(),batch:localStorage.getItem(BATCH_KEY)||''},warehouse}}
function writeSnapshot(){try{localStorage.setItem(SNAP_KEY,JSON.stringify(snapshot()))}catch(e){}}


/* =====================================================================
   V31.3.31 — CANVAS LIVE ENGINE
   ZASADA MASTER: oryginalne pliki MASTER PNG pozostają identyczne bajt w bajt.
   Na ekranie nie istnieją żadne stałe prostokątne DIV-y z wynikami. Runtime
   rysuje JEDNĄ powierzchnię canvas z chirurgicznie oczyszczonego szablonu LIVE
   pochodzącego z MASTER-a, a następnie wpisuje cyfry/teksty LIVE dokładnie w ich
   przeznaczone pola. Klikalne obszary są całkowicie niewidoczne.
   ===================================================================== */
const DIMS={1:[711,1536],2:[725,1536],3:[712,1536],4:[714,1536],5:[709,1536]};
const IMG_CACHE={};
const C={green:'#27e85a',blue:'#27a8ff',orange:'#ff9f25',white:'#ecefed',gold:'#ffc23d',muted:'#d2d6d2'};
function hot(style,action,label){return `<button class="prd30-hot" style="${style}" data-action="${action}" aria-label="${esc(label)}"></button>`}
function loadMaster(card){
  if(IMG_CACHE[card]?.complete)return Promise.resolve(IMG_CACHE[card]);
  return new Promise((resolve,reject)=>{const im=IMG_CACHE[card]||new Image();IMG_CACHE[card]=im;im.decoding='async';im.onload=()=>resolve(im);im.onerror=reject;if(!im.src)im.src=TEMPLATE[card]});
}
function xy(ctx,x,y,w=0,h=0){const W=ctx.canvas.width,H=ctx.canvas.height;return {x:W*x/100,y:H*y/100,w:W*w/100,h:H*h/100}}
function fontPx(ctx,px){return Math.max(7,Math.round(px*ctx.canvas.width/710))}
function text(ctx,t,x,y,size,color=C.white,weight=700,align='center',family='"Arial Narrow","Roboto Condensed",Arial,sans-serif'){
  const p=xy(ctx,x,y);ctx.save();ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`${weight} ${fontPx(ctx,size)}px ${family}`;ctx.shadowColor='rgba(0,0,0,.78)';ctx.shadowBlur=1.4;ctx.fillText(String(t),p.x,p.y);ctx.restore()
}
function pair(ctx,main,unit,x,y,mainSize,color=C.green,unitSize=14,unitColor=C.muted){
  const p=xy(ctx,x,y);ctx.save();ctx.textBaseline='middle';const fm=`800 ${fontPx(ctx,mainSize)}px "Arial Narrow","Roboto Condensed",Arial,sans-serif`,fu=`500 ${fontPx(ctx,unitSize)}px "Arial Narrow","Roboto Condensed",Arial,sans-serif`;ctx.font=fm;const wm=ctx.measureText(String(main)).width;ctx.font=fu;const wu=unit?ctx.measureText(String(unit)).width:0;const gap=unit?fontPx(ctx,4):0;let sx=p.x-(wm+wu+gap)/2;ctx.textAlign='left';ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=1.2;ctx.font=fm;ctx.fillStyle=color;ctx.fillText(String(main),sx,p.y);sx+=wm+gap;if(unit){ctx.font=fu;ctx.fillStyle=unitColor;ctx.fillText(String(unit),sx,p.y)}ctx.restore()
}
function metricCanvas(ctx,box,main,sub,color=C.green,mainSize=27,subSize=15){const [x,y,w,h]=box;const cy=y+h*.42;text(ctx,main,x+w/2,cy,mainSize,color,800);if(sub)text(ctx,sub,x+w/2,y+h*.80,subSize,C.muted,500)}
function operatorCanvas(ctx,box,name){const [x,y,w,h]=box;text(ctx,name,x+w/2,y+h/2,20,C.white,500)}
function lastRec(){return load()[0]||null}
function lastDate(){const a=lastRec();return a?localDatePL(a.date):localDatePL()}
function lastTime(){const a=lastRec();return a?String(a.time||'—'):'—'}
function hhmm(sec){sec=Math.max(0,Math.floor(n(sec)));return `${pad(Math.floor(sec/3600))}:${pad(Math.floor((sec%3600)/60))}`}
function remainingPalletBags(qty){qty=Math.max(0,Math.floor(n(qty)));const m=qty%68;return m?68-m:0}
function drawBarcodeCanvas(ctx,box,value){
  const r=xy(ctx,...box);ctx.save();ctx.fillStyle='#fff';ctx.fillRect(r.x,r.y,r.w,r.h);const raw=String(value||'').toUpperCase().replace(/[^0-9A-Z.\- ]/g,'');const full='*'+raw+'*';let units=16;for(const ch of full){const p=CODE39[ch]||CODE39['-'];for(let i=0;i<p.length;i++)units+=(p[i]==='w'?3:1)+1}const scale=r.w/units;let xx=r.x+7*scale;const top=r.y+r.h*.08,barH=r.h*.58;ctx.fillStyle='#000';for(const ch of full){const p=CODE39[ch]||CODE39['-'];for(let i=0;i<p.length;i++){const ww=(p[i]==='w'?3:1)*scale;if(i%2===0)ctx.fillRect(xx,top,Math.max(1,ww),barH);xx+=ww+scale}xx+=scale}ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${fontPx(ctx,19)}px Arial,sans-serif`;ctx.fillText(raw,r.x+r.w/2,r.y+r.h*.84);ctx.restore()
}
function unitText(ctx,u,x,y,size=12,color=C.muted){text(ctx,u,x,y,size,color,500)}
function paintCard1(ctx){
  const s1=cardStats(1,1),s2=cardStats(1,2),t=totalStats(1),tim=timerSeconds(1,currentShift());
  operatorCanvas(ctx,[12.0,48.7,27.0,2.3],operators()[1]);operatorCanvas(ctx,[59.0,48.7,27.0,2.3],operators()[2]);
  const vals=[[s1.tons,12.0,C.green,'t',2],[s1.count,26.7,C.green,'szt.',0],[s1.kg,40.8,C.white,'kg',0],[s2.tons,59.1,C.blue,'t',2],[s2.count,73.8,C.blue,'szt.',0],[s2.kg,89.2,C.white,'kg',0]];
  vals.forEach(([v,x,c,u,d])=>{text(ctx,fmt(v,d),x,56.9,27,c,700);unitText(ctx,u,x,59.0,13,C.muted)});
  pair(ctx,fmt(s1.rate,2),'t/h',24.0,63.8,25,C.green,13,C.green);pair(ctx,fmt(s2.rate,2),'t/h',72.0,63.8,25,C.blue,13,C.blue);
  text(ctx,hhmmss(tim),50,71.0,39,C.green,600);
  pair(ctx,fmt(t.tons,2),'t',11.5,82.7,26,C.green,13,C.green);pair(ctx,fmt(totalStats(4).pallets||0,0),'szt.',35.2,82.7,26,C.green,13,C.green);pair(ctx,fmt(t.kg,0),'kg',60.3,82.7,25,C.green,13,C.green);pair(ctx,fmt(t.rate,2),'t/h',85.0,82.7,25,C.green,13,C.green);
  text(ctx,lastDate(),52.5,91.4,14,C.white,500);text(ctx,lastTime(),52.5,93.1,14,C.white,500)
}
function paintCard2(ctx){
  const s1=cardStats(2,1),s2=cardStats(2,2),t=totalStats(2),tim=timerSeconds(2,currentShift()),w=whState();
  operatorCanvas(ctx,[12.0,55.1,28.0,2.3],operators()[1]);operatorCanvas(ctx,[59.0,55.1,28.0,2.3],operators()[2]);
  const xs=[11.0,25.8,40.5,58.1,72.9,89.0], vv=[s1.qty,0,0,s2.qty,0,0], cc=[C.green,C.white,C.white,C.blue,C.white,C.white];
  xs.forEach((x,i)=>{text(ctx,fmt(vv[i],0),x,63.2,28,cc[i],700);unitText(ctx,'szt.',x,65.5,12,C.muted)});
  text(ctx,hhmmss(tim),50,72.0,39,C.green,600);
  text(ctx,fmt(t.qty||0,0),16.0,82.6,31,C.green,700);unitText(ctx,'szt.',24.4,84.6,14,C.green);
  text(ctx,fmt(t.rate||0,2),50,82.6,31,C.blue,700);unitText(ctx,'worków/h',50,85.2,12,C.blue);
  text(ctx,fmt(n(w.bigbag.qty),0),80.0,82.6,31,C.orange,700);unitText(ctx,'szt.',88.5,84.6,14,C.orange);
  text(ctx,lastDate(),52.5,91.5,14,C.white,500);text(ctx,lastTime(),52.5,93.2,14,C.white,500)
}
function paintCard3(ctx){
  const s1=cardStats(3,1),s2=cardStats(3,2),t=totalStats(3),tim=timerSeconds(3,currentShift()),b=currentBatch();
  operatorCanvas(ctx,[12.0,51.8,28.0,2.3],operators()[1]);operatorCanvas(ctx,[59.0,51.8,28.0,2.3],operators()[2]);
  const xs=[12.2,27.5,42.5,58.5,74.5,89.5], vv=[0,s1.qty,0,0,s2.qty,0], cc=[C.white,C.green,C.white,C.white,C.blue,C.white];
  xs.forEach((x,i)=>text(ctx,fmt(vv[i],0),x,57.6,26,cc[i],700));
  text(ctx,hhmmss(tim),50,65.4,39,C.green,600);
  text(ctx,fmt(t.qty||0,0),20.3,76.4,35,C.green,700);unitText(ctx,'szt.',29.4,78.6,15,C.green);
  text(ctx,b,18.3,86.4,15,C.green,700);text(ctx,`${localDatePL()} ${clock().slice(0,5)}`,18.3,91.2,13,C.green,600);drawBarcodeCanvas(ctx,[32.25,83.75,32.2,8.75],b)
}
function paintCard4(ctx){
  const s1=cardStats(4,1),s2=cardStats(4,2),t=totalStats(4),tim=timerSeconds(4,currentShift());
  operatorCanvas(ctx,[12.0,60.5,28.0,2.3],operators()[1]);operatorCanvas(ctx,[59.0,60.5,28.0,2.3],operators()[2]);
  const xs=[11.4,26.0,40.7,58.0,72.8,88.4], vv=[s1.pallets,0,0,s2.pallets,0,0], cc=[C.green,C.white,C.white,C.blue,C.white,C.white];
  xs.forEach((x,i)=>{text(ctx,fmt(vv[i],0),x,68.0,28,cc[i],700);unitText(ctx,'szt.',x,70.3,12,C.muted)});
  text(ctx,hhmmss(tim),50,76.4,39,C.green,600);
  text(ctx,fmt(t.pallets||0,0),16.5,86.0,31,C.green,700);unitText(ctx,'szt.',25.0,88.0,14,C.green);
  text(ctx,fmt(t.rate||0,2),50,86.0,31,C.blue,700);unitText(ctx,'palet/h',50,88.5,12,C.blue);
  text(ctx,fmt(allWipBags(),0),80.0,86.0,31,C.orange,700);unitText(ctx,'worków WIP',80,88.5,11,C.orange);
  text(ctx,lastDate(),52.5,92.6,14,C.white,500);text(ctx,lastTime(),52.5,94.1,14,C.white,500)
}
function colX(i){return 37+20*i}
function card5Pair(ctx,col,y,main,unit,color,size=22,unitSize=12){pair(ctx,main,unit,colX(col)+9.5,y,size,color,unitSize,color)}
function paintCard5(ctx){
  const a1=cardStats(1,1),a2=cardStats(1,2),at=totalStats(1),b1=cardStats(2,1),b2=cardStats(2,2),bt=totalStats(2),c1=cardStats(3,1),c2=cardStats(3,2),ct=totalStats(3),d1=cardStats(4,1),d2=cardStats(4,2),dt=totalStats(4);
  operatorCanvas(ctx,[11.5,16.0,28.0,2.2],operators()[1]);operatorCanvas(ctx,[59.0,16.0,28.0,2.2],operators()[2]);
  const r1=(s,c,col)=>{card5Pair(ctx,col,24.1,fmt(s.tons,2),'t',c,23,12);card5Pair(ctx,col,26.2,fmt(s.kg,0),'kg',C.white,16,10);card5Pair(ctx,col,30.2,fmt(s.rate,2),'t/h',c,19,11);card5Pair(ctx,col,33.8,hhmm(s.seconds),'h',c,18,10)};
  r1(a1,C.green,0);r1(a2,C.blue,1);r1(at,C.orange,2);
  const r2=(s,c,col)=>{card5Pair(ctx,col,39.5,fmt(s.qty,0),'szt.',c,23,12);card5Pair(ctx,col,42.0,fmt(s.qty*1000,0),'kg',C.white,16,10);card5Pair(ctx,col,44.0,fmt(s.tons,2),'t',c,19,11);card5Pair(ctx,col,47.1,fmt(s.rate,2),'t/h',c,18,10)};
  r2(b1,C.green,0);r2(b2,C.blue,1);r2(bt,C.orange,2);
  const r3=(s,c,col)=>{card5Pair(ctx,col,52.6,fmt(s.qty,0),'szt.',c,22,11);card5Pair(ctx,col,54.8,fmt(s.tons,2),'t',C.white,16,10);card5Pair(ctx,col,59.0,fmt(Math.floor(n(s.qty)/68),0),'szt.',c,19,10);card5Pair(ctx,col,63.1,fmt(remainingPalletBags(s.qty),0),'szt.',c,18,10)};
  r3(c1,C.green,0);r3(c2,C.blue,1);r3(ct,C.orange,2);
  const r4=(s,c,col)=>{card5Pair(ctx,col,66.2,fmt(s.pallets,0),'palet',c,20,10);card5Pair(ctx,col,68.2,fmt(s.bags,0),'worków',C.white,15,9);card5Pair(ctx,col,70.0,fmt(s.tons,2),'t',C.white,16,10);text(ctx,fmt(s.pallets,0),colX(col)+9.5,73.5,19,c,700);card5Pair(ctx,col,76.8,fmt(s.filmKg,2),'kg',c,18,10)};
  r4(d1,C.green,0);r4(d2,C.blue,1);r4(dt,C.orange,2);
  pair(ctx,fmt(at.tons,2),'t',10.2,87.0,20,C.green,10,C.green);pair(ctx,fmt(at.kg,0),'kg',10.2,89.0,13,C.green,8,C.green);
  pair(ctx,fmt(ct.qty,0),'szt.',28.8,87.0,20,C.green,10,C.green);pair(ctx,fmt(ct.tons,2),'t',28.8,89.0,13,C.green,8,C.green);
  pair(ctx,fmt(dt.pallets,0),'szt.',48.2,87.0,20,C.green,10,C.green);pair(ctx,fmt(dt.tons,2),'t',48.2,89.0,13,C.green,8,C.green);
  pair(ctx,fmt(bt.qty,0),'szt.',67.4,87.0,20,C.green,10,C.green);pair(ctx,fmt(bt.tons,2),'t',67.4,89.0,13,C.green,8,C.green);
  pair(ctx,fmt(dt.filmKg,2),'kg',87.0,88.0,20,C.green,10,C.green);
  text(ctx,lastDate(),53.0,92.7,14,C.white,500);text(ctx,lastTime(),53.0,94.2,14,C.white,500)
}
function paintDynamicCanvas(ctx,card){if(card===1)return paintCard1(ctx);if(card===2)return paintCard2(ctx);if(card===3)return paintCard3(ctx);if(card===4)return paintCard4(ctx);if(card===5)return paintCard5(ctx)}
async function paintCanvas(card=activeCard){
  const canvas=document.querySelector('.prd30-canvas');if(!canvas||Number(canvas.dataset.card)!==Number(card)||!document.documentElement.classList.contains('prd31-open'))return;
  try{const im=await loadMaster(card);if(Number(canvas.dataset.card)!==Number(card))return;const [w,h]=DIMS[card]||[im.naturalWidth,im.naturalHeight];if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.clearRect(0,0,w,h);ctx.drawImage(im,0,0,w,h);paintDynamicCanvas(ctx,card)}catch(e){console.error('V31.3.31 canvas render',e)}
}
function hotspots(card){
  const common=[hot('left:0%;top:0%;width:20%;height:10%','home','POWRÓT'),hot('left:80%;top:0%;width:20%;height:10%','sync','SYNCHRONIZUJ'),hot('left:0%;top:94%;width:24%;height:6%','prev','Poprzednia karta'),hot('left:76%;top:94%;width:24%;height:6%','next','Następna karta')];
  if(card===1)return common.concat([hot('left:5%;top:64%;width:24%;height:12%','start','START'),hot('left:72%;top:64%;width:24%;height:12%','stop','STOP'),hot('left:4%;top:45%;width:45%;height:16%','result','Wynik I zmiany'),hot('left:51%;top:45%;width:45%;height:16%','result','Wynik II zmiany'),hot('left:3%;top:78%;width:94%;height:9%','summary','Podsumowanie dnia'),hot('left:4%;top:44%;width:43%;height:6%','operator1','Operator I zmiany'),hot('left:53%;top:44%;width:43%;height:6%','operator2','Operator II zmiany')]).join('');
  if(card===2)return common.concat([hot('left:5%;top:68%;width:24%;height:11%','start','START'),hot('left:72%;top:68%;width:24%;height:11%','stop','STOP'),hot('left:3%;top:53%;width:46%;height:16%','result','Wynik I zmiany'),hot('left:51%;top:53%;width:46%;height:16%','result','Wynik II zmiany'),hot('left:4%;top:53%;width:43%;height:5%','operator1','Operator I zmiany'),hot('left:53%;top:53%;width:43%;height:5%','operator2','Operator II zmiany')]).join('');
  if(card===3)return common.concat([hot('left:5%;top:64%;width:24%;height:11%','start','START'),hot('left:72%;top:64%;width:24%;height:11%','stop','STOP'),hot('left:3%;top:50%;width:46%;height:14%','result','Wynik I zmiany'),hot('left:51%;top:50%;width:46%;height:14%','result','Wynik II zmiany'),hot('left:4%;top:50%;width:43%;height:5%','operator1','Operator I zmiany'),hot('left:53%;top:50%;width:43%;height:5%','operator2','Operator II zmiany'),hot('left:65%;top:83%;width:31%;height:5%','batch','GENERUJ NOWĄ PARTIĘ'),hot('left:65%;top:88%;width:31%;height:5%','print','DRUKUJ ETYKIETĘ')]).join('');
  if(card===4)return common.concat([hot('left:5%;top:70%;width:24%;height:10%','start','START'),hot('left:72%;top:70%;width:24%;height:10%','stop','STOP'),hot('left:3%;top:57%;width:46%;height:14%','result','Wynik I zmiany'),hot('left:51%;top:57%;width:46%;height:14%','result','Wynik II zmiany'),hot('left:4%;top:57%;width:43%;height:5%','operator1','Operator I zmiany'),hot('left:53%;top:57%;width:43%;height:5%','operator2','Operator II zmiany'),hot('left:4%;top:12%;width:38%;height:22%','sync','Liczniki cykli'),hot('left:4%;top:35%;width:30%;height:16%','sync','Zużycie folii')]).join('');
  return common.concat([hot('left:2%;top:20%;width:96%;height:14%','card1','Produkcja peletu'),hot('left:2%;top:35%;width:96%;height:14%','card2','BIG BAG'),hot('left:2%;top:50%;width:96%;height:14%','card3','Worki 15 kg'),hot('left:2%;top:65%;width:96%;height:14%','card4','Pakowanie streczem')]).join('');
}

function ensureViewport(){let vp=document.querySelector('meta[name="viewport"]');if(!vp){vp=document.createElement('meta');vp.name='viewport';document.head.appendChild(vp)}vp.setAttribute('content','width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5,user-scalable=yes,viewport-fit=cover');document.documentElement.style.overflowX='hidden';document.body.style.overflowX='hidden'}
function render(card=1){activeCard=Math.max(1,Math.min(5,Number(card)||1));ensureViewport();document.documentElement.classList.add('prd31-open');const app=document.getElementById('app');if(!app)return;const d=DIMS[activeCard]||[710,1536];app.innerHTML=`<main class="prd30"><section class="prd30-stage" data-card="${activeCard}" style="aspect-ratio:${d[0]}/${d[1]}"><canvas class="prd30-canvas" data-card="${activeCard}" width="${d[0]}" height="${d[1]}" aria-label="PRODUKCJA — MASTER KARTA ${activeCard}/5"></canvas><div class="prd30-hots">${hotspots(activeCard)}</div></section></main>`;bind();startTick();writeSnapshot();paintCanvas(activeCard);window.scrollTo({top:0,left:0,behavior:'auto'})}
function refreshLive(){if(document.documentElement.classList.contains('prd31-open'))paintCanvas(activeCard)}
function startTick(){clearInterval(timerTick);timerTick=setInterval(refreshLive,1000)}
function leave(name){clearInterval(timerTick);timerTick=null;document.documentElement.classList.remove('prd31-open');return typeof previousGo==='function'?previousGo(name):undefined}
function prev(){render(activeCard===1?5:activeCard-1)}
function next(){render(activeCard===5?1:activeCard+1)}

function bind(){const root=document.querySelector('.prd30-stage');if(!root)return;root.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();e.stopPropagation();activate(b.dataset.action)});root.addEventListener('pointerdown',e=>{const b=e.target.closest('.prd30-hot');if(b){b.classList.add('prd30-press');setTimeout(()=>b.classList.remove('prd30-press'),240)}});root.addEventListener('touchstart',e=>{touchX=e.touches?.[0]?.clientX??null},{passive:true});root.addEventListener('touchend',e=>{if(touchX==null)return;const x=e.changedTouches?.[0]?.clientX??touchX,dx=x-touchX;touchX=null;if(Math.abs(dx)>75){dx<0?next():prev()}},{passive:true})}
function activate(a){if(a==='home')return leave('home');if(a==='sync'){writeSnapshot();refreshLive();flash('SYNCHRONIZOWANO — PRODUKCJA ↔ MAGAZYN ↔ CENTRALNA BAZA LIVE.');return}if(a==='prev')return prev();if(a==='next')return next();if(a==='start')return startTimer(activeCard,currentShift());if(a==='stop'){const sh=currentShift(),sec=stopTimer(activeCard,sh);return openResult(activeCard,sh,sec)}if(a==='result')return openResult(activeCard,currentShift(),timerSeconds(activeCard,currentShift()));if(a==='summary')return render(5);if(a==='operator1')return openOperator(1);if(a==='operator2')return openOperator(2);if(a==='batch'){generateBatch();return openBarcode()};if(a==='print')return printLabel();if(/^card[1-4]$/.test(a))return render(Number(a.slice(-1)))}

function modal(html){const m=document.createElement('div');m.className='prd30-modal';m.innerHTML=`<div class="prd30-modal-card">${html}</div>`;document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)m.remove()});m.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>m.remove());return m}
function openOperator(shift){const o=operators(),m=modal(`<button class="prd30-x" data-close>×</button><h2>OPERATOR — ${shift===1?'I':'II'} ZMIANA</h2><p>Zmiana operatora aktualizuje wszystkie karty PRODUKCJI.</p><form class="prd30-form" data-form><div class="prd30-field wide"><label>IMIĘ I NAZWISKO</label><input name="name" value="${esc(o[shift])}" required></div><div class="prd30-actions"><button class="prd30-save">ZAPISZ</button><button type="button" class="prd30-cancel" data-close>ANULUJ</button></div></form>`);m.querySelector('[data-form]').onsubmit=e=>{e.preventDefault();setOperator(shift,new FormData(e.currentTarget).get('name'));m.remove();flash('Operator został zapisany.')}}
function resultInfo(card){if(card===1)return {title:'PRODUKCJA PELETU',label:'Wyprodukowano [t]',step:'0.01',unit:'t'};if(card===2)return {title:'PRODUKCJA BIG BAG',label:'Wypełnione BIG BAG [szt.]',step:'1',unit:'szt.'};if(card===3)return {title:'PRODUKCJA WORKÓW 15 kg',label:'Wyprodukowano worków [szt.]',step:'1',unit:'szt.'};return {title:'PAKOWANIE STRECZEM',label:'Zapakowano palet [szt.]',step:'1',unit:'palet'}}
function openResult(card,shift,sec=0){if(card>4)return;const info=resultInfo(card),s=whState(),extra=card===4?`<div class="prd30-field"><label>TYP PALETY</label><select name="palletType"><option>Paleta krajowa</option><option>Europaleta (EPAL)</option></select></div><div class="prd30-field"><label>ZUŻYCIE FOLII [kg]</label><input name="filmKg" type="number" step="0.01" min="0" value="0"></div>`:'';const m=modal(`<button class="prd30-x" data-close>×</button><h2>${info.title} — ${shift===1?'I':'II'} ZMIANA</h2><p>Zapis jest LIVE. Po zatwierdzeniu odpowiednie stany MAGAZYNU oraz centralne podsumowania zostaną przeliczone automatycznie.</p><div class="prd30-status"><div><span>Czas maszyny</span><b>${hhmmss(sec)}</b></div><div><span>Partia</span><b>${esc(currentBatch())}</b></div><div><span>Pellet luzem w magazynie</span><b>${fmt(s.bulk.tons,3)} t</b></div><div><span>Worki WIP</span><b>${fmt(allWipBags(),0)} szt.</b></div></div><form class="prd30-form" data-result><div class="prd30-field"><label>${info.label}</label><input name="amount" type="number" min="0" step="${info.step}" required autofocus></div><div class="prd30-field"><label>ZMIANA</label><select name="shift"><option value="1" ${shift===1?'selected':''}>I — 06:30–14:30</option><option value="2" ${shift===2?'selected':''}>II — 15:00–23:00</option></select></div>${extra}<div class="prd30-field wide"><label>NUMER PARTII</label><input name="batch" value="${esc(currentBatch())}"></div><div class="prd30-actions"><button class="prd30-save">ZAPISZ I AKTUALIZUJ SYSTEM</button><button type="button" class="prd30-cancel" data-close>ANULUJ</button></div></form>`);m.querySelector('[data-result]').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.currentTarget),sh=Number(fd.get('shift'))||shift,batch=String(fd.get('batch')||currentBatch()),amount=n(fd.get('amount'));let res;if(card===1)res=commitBulk({tons:amount,shift:sh,batch,seconds:sec});else if(card===2)res=commitBigbag({qty:amount,shift:sh,batch,seconds:sec});else if(card===3)res=commitBags({qty:amount,shift:sh,batch,seconds:sec});else res=commitStretch({pallets:amount,palletType:fd.get('palletType'),filmKg:fd.get('filmKg'),shift:sh,batch,seconds:sec});if(!res.ok){alert(res.message);return}resetTimer(card,sh);m.remove();refreshLive();flash(res.message)}}

const CODE39={
'0':'nnwwnwnnw','1':'wnnwnnnnw','2':'nnwwnnnnw','3':'wnwwnnnnn','4':'nnnwwnnnw','5':'wnnwwnnnn','6':'nnwwwnnnn','7':'nnnwnnwnw','8':'wnnwnnwnn','9':'nnwwnnwnn',
'A':'wnnnnwnnw','B':'nnwnnwnnw','C':'wnwnnwnnn','D':'nnnnwwnnw','E':'wnnnwwnnn','F':'nnwnwwnnn','G':'nnnnnwwnw','H':'wnnnnwwnn','I':'nnwnnwwnn','J':'nnnnwwwnn',
'K':'wnnnnnnww','L':'nnwnnnnww','M':'wnwnnnnwn','N':'nnnnwnnww','O':'wnnnwnnwn','P':'nnwnwnnwn','Q':'nnnnnnwww','R':'wnnnnnwwn','S':'nnwnnnwwn','T':'nnnnwnwwn',
'U':'wwnnnnnnw','V':'nwwnnnnnw','W':'wwwnnnnnn','X':'nwnnwnnnw','Y':'wwnnwnnnn','Z':'nwwnwnnnn','-':'nwnnnnwnw','.':'wwnnnnwnn',' ':'nwwnnnwnn','*':'nwnnwnwnn'};
function barcodeSvg(text){text=String(text||'').toUpperCase().replace(/[^0-9A-Z.\- ]/g,'');const full='*'+text+'*';let x=8,rects='',height=72;for(const ch of full){const p=CODE39[ch]||CODE39['-'];for(let i=0;i<p.length;i++){const w=p[i]==='w'?3:1;if(i%2===0)rects+=`<rect x="${x}" y="2" width="${w}" height="${height}" fill="#000"/>`;x+=w}x+=1}return `<svg viewBox="0 0 ${x+8} ${height+4}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`}
function openBarcode(){const b=currentBatch(),m=modal(`<button class="prd30-x" data-close>×</button><h2>PARTIA / KOD KRESKOWY</h2><p>Numer partii jest wspólny dla produkcji, magazynu i późniejszego wydania towaru.</p><div class="prd30-barcode">${barcodeSvg(b)}<b>${esc(b)}</b></div><div class="prd30-actions"><button class="prd30-orange" data-new>GENERUJ NOWĄ PARTIĘ</button><button class="prd30-blue" data-print>DRUKUJ ETYKIETĘ</button><button class="prd30-cancel" data-close>ZAMKNIJ</button></div>`);m.querySelector('[data-new]').onclick=()=>{generateBatch();m.remove();openBarcode()};m.querySelector('[data-print]').onclick=()=>printLabel()}
function printLabel(){const b=currentBatch(),svg=barcodeSvg(b),w=window.open('','_blank');if(!w){flash('Przeglądarka zablokowała okno wydruku.');return}w.document.open();w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(b)}</title><style>body{font-family:Arial;margin:24px;text-align:center}.label{width:620px;max-width:92vw;margin:auto;border:2px solid #000;padding:24px}h1{font-size:24px;margin:0 0 8px}svg{width:100%;height:130px}b{font-size:28px}small{display:block;margin-top:12px;font-size:14px}@media print{button{display:none}.label{border:0}}</style><div class="label"><h1>L&M TECHNIC ENERGY</h1><h2>PELET DRZEWNY PREMIUM A1 — PARTIA</h2>${svg}<b>${esc(b)}</b><small>Data: ${localDatePL()} • ${clock()}</small><small>Europejski Kalkulator Peletu 1.2 PREMIUM • ${VERSION}</small></div><p><button onclick="print()">DRUKUJ</button></p>`);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){}},250)}

function flash(text){let d=document.querySelector('.prd30-toast');if(!d){d=document.createElement('div');d.className='prd30-toast';document.body.appendChild(d)}d.textContent=text;d.classList.add('show');clearTimeout(d._t);d._t=setTimeout(()=>d.classList.remove('show'),2300)}
function enhanceHome(){const root=document.querySelector('.v316-home');if(!root||root.querySelector('[data-prd30-home]'))return;const add=(left,fn,label,attr)=>{const b=document.createElement('button');b.className='prd30-homehot';b.setAttribute('data-prd30-home',attr);b.setAttribute('aria-label',label);b.style.left=left;b.style.top='44.2%';b.style.width='24.1%';b.style.height='10.5%';b.onclick=fn;root.appendChild(b)};add('49.5%',()=>window.go('production'),'PRODUKCJA','production');add('74.7%',()=>window.go('warehouse'),'MAGAZYN','warehouse')}

window.LM_PRODUCTION_V31331={version:VERSION,render,refresh:refreshLive,load,snapshot,commitBulk,commitBigbag,commitBags,commitStretch,wipBags:allWipBags,generateBatch,currentBatch};
window.LM_DATA_HUB_V31331={version:VERSION,snapshot,production:()=>snapshot().production,warehouse:()=>snapshot().warehouse,refresh(){writeSnapshot();window.dispatchEvent(new CustomEvent('lm:datahub-changed',{detail:snapshot()}));return snapshot()}};
window.renderProductionV31331=()=>render(1);window.renderProductionV31330=window.renderProductionV31331;window.LM_PRODUCTION_V31330=window.LM_PRODUCTION_V31331;window.LM_DATA_HUB_V31330=window.LM_DATA_HUB_V31331;
window.go=function(name){if(name==='production')return render(1);document.documentElement.classList.remove('prd31-open');clearInterval(timerTick);timerTick=null;const out=typeof previousGo==='function'?previousGo(name):undefined;if(name==='home')setTimeout(enhanceHome,0);return out};

window.addEventListener('lm:warehouse-changed',()=>{writeSnapshot();refreshLive()});
window.addEventListener('storage',e=>{if([KEY,TIMER_KEY,OP_KEY,BATCH_KEY,'lm_v31314_warehouse_master_records'].includes(e.key)){writeSnapshot();refreshLive()}});
const mo=new MutationObserver(()=>enhanceHome());mo.observe(document.documentElement,{subtree:true,childList:true});
setTimeout(()=>{enhanceHome();writeSnapshot();try{navigator.serviceWorker?.controller?.postMessage({type:'WARM_MASTER_ASSETS'})}catch(e){}},700);
})();
