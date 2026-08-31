/* ================================================================
   L&M TECHNIC ENERGY — Europejski Kalkulator Peletu 1.2 PREMIUM
   V31.3.29 — LIVE PULPIT / SINGLE SOURCE OF TRUTH
   - wskaźnik opłacalności z lm_calc_v15
   - struktura kosztów z lm_calc_v15
   - szybka tabela weryfikacyjna w Kalkulatorze
   - dotknięcie panelu prowadzi dokładnie do źródła danych
   Grafika MASTER pozostaje bez zmian.
   ================================================================ */
(function(){
'use strict';
const VERSION='V31.3.29';
const DEFAULTS={purchase:1250,sell:1580,distance:535,rate:4.25,work:42,bags:37.67,pallet:25,other:0,minMargin:3};
const INPUT_MAP={purchase:'vc_purchase',sell:'vc_sell',distance:'vc_distance',rate:'vc_rate',work:'vc_work',bags:'vc_bags',pallet:'vc_pallet',other:'vc_other',minMargin:'vc_minmargin'};
const COLORS=['#249ff2','#e8951f','#6fd515','#8f55e8','#1a73e8','#5e7a93'];
let scheduled=false;
function n(v,f=0){const x=Number(String(v??'').replace(',','.').replace(/\s/g,''));return Number.isFinite(x)?x:f}
function readStorage(){try{return {...DEFAULTS,...(JSON.parse(localStorage.getItem('lm_calc_v15')||'{}')||{})}}catch(e){return {...DEFAULTS}}}
function qtyStorage(){try{return n(localStorage.getItem('lm_qty'),26)||26}catch(e){return 26}}
function readCalc(preferDom=true){
  const x=readStorage();
  if(preferDom&&document.getElementById('vc_purchase')){
    for(const [k,id] of Object.entries(INPUT_MAP))x[k]=n(document.getElementById(id)?.value,x[k]);
  }
  const qty=preferDom&&document.getElementById('vc_qty')?n(document.getElementById('vc_qty').value,qtyStorage()):qtyStorage();
  const trucks=qty/26;
  const transportTruck=x.distance*2*x.rate;
  const transportTotal=transportTruck*trucks;
  const transportT=qty?transportTotal/qty:0;
  const parts=[x.purchase,transportT,x.work,x.bags,x.pallet,x.other];
  const full=parts.reduce((a,b)=>a+n(b),0);
  const margin=x.sell-full;
  const marginPct=x.sell?margin/x.sell*100:0;
  return {...x,qty,trucks,transportTruck,transportTotal,transportT,full,margin,marginPct,totalMargin:margin*qty,parts,ok:marginPct>=x.minMargin};
}
function saveFromDom(){
  if(!document.getElementById('vc_purchase'))return;
  const x=readStorage();for(const [k,id] of Object.entries(INPUT_MAP))x[k]=n(document.getElementById(id)?.value,x[k]);
  try{localStorage.setItem('lm_calc_v15',JSON.stringify(x));localStorage.setItem('lm_qty',String(n(document.getElementById('vc_qty')?.value,26)||26))}catch(e){}
}
function pln(v){return n(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł'}
function val(v){return n(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(v){return n(v).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function partRows(c){
  const names=['Zakup pelletu','Transport','Workowanie','Worki / opakowanie','Paleta','Inne koszty'];
  return names.map((name,i)=>({name,value:n(c.parts[i]),share:c.full?Math.max(0,n(c.parts[i]))/c.full*100:0,color:COLORS[i]}));
}
function gaugeSvg(c){
  const min=-20,max=20,clamped=Math.max(min,Math.min(max,c.marginPct));
  const angle=-90+(clamped-min)/(max-min)*180;
  const color=c.ok?'#8cff18':'#ff5a50';
  return `<svg class="lm329-gauge-svg" viewBox="0 0 260 142" aria-hidden="true">
    <defs><linearGradient id="lm329g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cf241d"/><stop offset=".48" stop-color="#efac18"/><stop offset="1" stop-color="#54c900"/></linearGradient></defs>
    <path d="M24 120 A106 106 0 0 1 236 120" pathLength="100" fill="none" stroke="url(#lm329g)" stroke-width="18" stroke-linecap="round"/>
    <g transform="rotate(${angle.toFixed(2)} 130 120)"><line x1="130" y1="120" x2="130" y2="38" stroke="#e9f4ff" stroke-width="5" stroke-linecap="round"/><circle cx="130" cy="120" r="10" fill="#183c66" stroke="#b9d9ff" stroke-width="4"/></g>
    <text x="24" y="139" class="lm329-gauge-tick">−20%</text><text x="119" y="139" class="lm329-gauge-tick">0</text><text x="220" y="139" class="lm329-gauge-tick">+20%</text>
    <text x="130" y="91" text-anchor="middle" fill="${color}" class="lm329-gauge-value">${esc(pct(c.marginPct))}</text>
  </svg>`;
}
function ensureOverlay(root,cls,style){let el=root.querySelector('.'+cls);if(!el){el=document.createElement('div');el.className=cls+' lm329-overlay';Object.assign(el.style,style);root.appendChild(el)}return el}
function enhanceHome(){
  const root=document.querySelector('.lm-master-home');if(!root)return;
  const c=readCalc(false), rows=partRows(c);
  const sig=[c.purchase,c.sell,c.distance,c.rate,c.work,c.bags,c.pallet,c.other,c.minMargin,c.qty].map(x=>n(x).toFixed(4)).join('|');
  if(root.dataset.lm329Sig===sig)return;
  root.dataset.lm329Sig=sig;
  const profit=ensureOverlay(root,'lm329-profit',{left:(8/941*100)+'%',top:(1008/1594*100)+'%',width:(444/941*100)+'%',height:(383/1594*100)+'%'});
  profit.innerHTML=`<div class="lm329-head">WSKAŹNIK OPŁACALNOŚCI <span>LIVE</span></div>${gaugeSvg(c)}<div class="lm329-profit-meta"><span>Minimalna marża wymagana <b>${pct(c.minMargin)}</b></span><span>Aktualna marża <b class="${c.ok?'ok':'bad'}">${pct(c.marginPct)}</b></span></div><div class="lm329-status ${c.ok?'ok':'bad'}">${c.ok?'✓ POWYŻEJ MINIMUM':'✕ PONIŻEJ MINIMALNEJ MARŻY'}</div>`;
  const costs=ensureOverlay(root,'lm329-costs',{left:(461/941*100)+'%',top:(1008/1594*100)+'%',width:(470/941*100)+'%',height:(383/1594*100)+'%'});
  let stops='',acc=0;for(const r of rows){const next=acc+r.share;stops+=`${r.color} ${acc.toFixed(2)}% ${next.toFixed(2)}%,`;acc=next}if(acc<100)stops+=`#263226 ${acc.toFixed(2)}% 100%,`;stops=stops.replace(/,$/,'');
  costs.innerHTML=`<div class="lm329-head">STRUKTURA KOSZTÓW <small>(PLN / t)</small> <span>LIVE</span></div><div class="lm329-cost-main"><div class="lm329-donut" style="background:conic-gradient(${stops})"><i></i></div><div class="lm329-legend">${rows.map(r=>`<div><em style="background:${r.color}"></em><span>${esc(r.name)}</span><b>${val(r.value)}</b><small>${r.share.toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})}%</small></div>`).join('')}</div></div><div class="lm329-total"><span>KOSZT CAŁKOWITY</span><b>${val(c.full)} PLN/t <small>(100%)</small></b></div>`;
  const summary=ensureOverlay(root,'lm329-summary',{left:(8/941*100)+'%',top:(1399/1594*100)+'%',width:(923/941*100)+'%',height:(130/1594*100)+'%'});
  summary.innerHTML=`<div class="lm329-summary-title">KALKULATOR — PODSUMOWANIE <span>LIVE</span></div><div class="lm329-summary-grid"><div><small>KOSZT PEŁNY</small><b>${val(c.full)}<em> PLN/t</em></b></div><div><small>CENA SPRZEDAŻY</small><b>${val(c.sell)}<em> PLN/t</em></b></div><div><small>MARŻA NETTO</small><b class="${c.margin>=0?'ok':'bad'}">${val(c.margin)}<em> PLN/t</em></b></div><div><small>MARŻA %</small><b class="${c.ok?'ok':'bad'}">${pct(c.marginPct)}</b></div><div class="decision ${c.ok?'ok':'bad'}">${c.ok?'✓ OPŁACA SIĘ':'✕ NIE OPŁACA SIĘ'}</div></div>`;
  const panels=[...root.querySelectorAll('.lm-master-hot.panel')];
  const by=(txt)=>panels.find(b=>(b.getAttribute('aria-label')||'').includes(txt));
  const ph=by('WSKAŹNIK');if(ph&&!ph.dataset.lm329){ph.dataset.lm329='1';ph.onclick=()=>openCalculatorSection('profit')}
  const ch=by('STRUKTURA');if(ch&&!ch.dataset.lm329){ch.dataset.lm329='1';ch.onclick=()=>openCalculatorSection('costs')}
  const sh=by('PODSUMOWANIE');if(sh&&!sh.dataset.lm329){sh.dataset.lm329='1';sh.onclick=()=>openCalculatorSection('profit')}
}
function renderVerify(){
  const screen=document.querySelector('.v15-screen'),result=document.getElementById('vc_result');if(!screen||!result)return;
  const c=readCalc(true),rows=partRows(c);
  let box=document.getElementById('vc_cost_structure');if(!box){box=document.createElement('section');box.id='vc_cost_structure';box.className='lm329-verify';result.insertAdjacentElement('afterend',box)}
  const sig=[c.purchase,c.sell,c.distance,c.rate,c.work,c.bags,c.pallet,c.other,c.minMargin,c.qty].map(x=>n(x).toFixed(4)).join('|');
  if(box.dataset.lm329Sig===sig)return;
  box.dataset.lm329Sig=sig;
  box.innerHTML=`<div class="lm329-verify-head"><div><h4>STRUKTURA KOSZTÓW — WERYFIKACJA</h4><small>Te same dane zasilają Pulpit. Każda pozycja jest liczona na 1 tonę.</small></div><span>LIVE</span></div><div class="lm329-verify-table"><div class="hdr"><b>SKŁADNIK</b><b>PLN / t</b><b>UDZIAŁ</b></div>${rows.map(r=>`<div><span><i style="background:${r.color}"></i>${esc(r.name)}</span><b>${val(r.value)}</b><b>${r.share.toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})}%</b></div>`).join('')}<div class="total"><span>RAZEM — KOSZT PEŁNY</span><b>${val(c.full)} PLN/t</b><b>100%</b></div></div><div class="lm329-verify-foot"><span>Sprzedaż: <b>${val(c.sell)} PLN/t</b></span><span>Marża netto: <b class="${c.margin>=0?'ok':'bad'}">${val(c.margin)} PLN/t</b></span><span>Marża: <b class="${c.ok?'ok':'bad'}">${pct(c.marginPct)}</b></span><span>Minimum: <b>${pct(c.minMargin)}</b></span></div>`;
  // Semantyczny kolor istniejących wyników kalkulatora: strata = czerwony.
  result.querySelectorAll('.v15-kpi').forEach(k=>{const label=k.querySelector('span')?.textContent||'',b=k.querySelector('b');if(!b)return;if(label.includes('Marża netto')||label.includes('Marża całej')){b.style.color=c.margin>=0?'#8cff18':'#ff6258'}else if(label.includes('Marża %'))b.style.color=c.ok?'#8cff18':'#ff6258'});
}
function enhanceCalculator(){
  const screen=document.querySelector('.v15-screen');if(!screen)return;
  const result=document.getElementById('vc_result');if(result)result.closest('.v15-panel')?.setAttribute('id','vc_profitability');
  if(!screen.dataset.lm329){screen.dataset.lm329='1';const ids=[...Object.values(INPUT_MAP),'vc_qty'];for(const id of ids){const el=document.getElementById(id);if(!el)continue;const on=()=>{saveFromDom();renderVerify()};el.addEventListener('input',on);el.addEventListener('change',on)}document.getElementById('vc_calc')?.addEventListener('click',()=>setTimeout(renderVerify,0));document.getElementById('vc_calc')?.addEventListener('touchend',()=>setTimeout(renderVerify,0),{passive:true})}
  renderVerify();
  const target=sessionStorage.getItem('lm329_calc_target');if(target){sessionStorage.removeItem('lm329_calc_target');setTimeout(()=>scrollCalc(target),80)}
}
function scrollCalc(target){const id=target==='costs'?'vc_cost_structure':'vc_profitability';document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
function openCalculatorSection(target){try{sessionStorage.setItem('lm329_calc_target',target)}catch(e){}window.go('calculator');setTimeout(()=>{enhanceCalculator();scrollCalc(target)},100)}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhanceHome();enhanceCalculator()})}
window.lm329ReadCalc=()=>readCalc(false);window.lm329RefreshHome=enhanceHome;window.lm329OpenCalculatorSection=openCalculatorSection;
const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
document.addEventListener('change',()=>{if(document.querySelector('.v15-screen'))setTimeout(schedule,0)},true);
window.addEventListener('storage',schedule);window.addEventListener('pageshow',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();

/* V31.3.38 — R38 LIVE STATS HOTFIX
   Po każdym odświeżeniu bazy RYNKI EU karta główna jest renderowana ponownie
   wyłącznie wtedy, gdy użytkownik właśnie ją ogląda. Dzięki temu istniejące
   statystyki MASTER, liczniki krajów, liczba nowych firm i data/wersja bazy
   pokazują aktualne dane bez zmiany wyglądu, CSS ani układu. */
(function(){
'use strict';
const original=window.eu31Load;
if(typeof original!=='function'||original.__r38LiveStats)return;
const wrapped=async function(){
  const result=await original.apply(this,arguments);
  try{
    if(document.querySelector('.eu31-overview-page')&&typeof window.eu31Home==='function')window.eu31Home(false);
  }catch(e){console.warn('R38 LIVE STATS',e)}
  return result;
};
wrapped.__r38LiveStats=true;
window.eu31Load=wrapped;
})();
