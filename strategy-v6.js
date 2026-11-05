'use strict';
/* V6: educational strategy checks based on user-supplied Binomo PDF rules.
   Requires V5 app.js globals: candles, normalize, status, $.
   Uses screenshot-derived proxy OHLC unless manually replaced. */
(() => {
const el=id=>document.getElementById(id);
const num=id=>Number(el(id).value);
const fmt=n=>Number.isFinite(n)?n.toFixed(3):'—';
function result(label,detail,kind='wait'){
 const box=el('strategyResult');box.className='strategy-result '+kind;
 el('strategyVerdict').textContent=label;el('strategyDetails').textContent=detail;
}
function sma(a,n){return a.map((_,i)=>i<n-1?NaN:a.slice(i-n+1,i+1).reduce((x,y)=>x+y,0)/n)}
function bb(cs,period,mult){const c=cs.map(x=>x.close),mid=sma(c,period);return c.map((_,i)=>{if(i<period-1)return null;const a=c.slice(i-period+1,i+1),sd=Math.sqrt(a.reduce((s,x)=>s+(x-mid[i])**2,0)/period);return{mid:mid[i],upper:mid[i]+mult*sd,lower:mid[i]-mult*sd,width:2*mult*sd}})}
function psar(cs,step,maxAF){let up=cs[1].close>=cs[0].close,ep=up?Math.max(cs[0].high,cs[1].high):Math.min(cs[0].low,cs[1].low),sar=up?Math.min(cs[0].low,cs[1].low):Math.max(cs[0].high,cs[1].high),af=step;const out=[NaN,sar];for(let i=2;i<cs.length;i++){sar+=af*(ep-sar);if(up){sar=Math.min(sar,cs[i-1].low,cs[i-2].low);if(cs[i].low<sar){up=false;sar=ep;ep=cs[i].low;af=step}else if(cs[i].high>ep){ep=cs[i].high;af=Math.min(maxAF,af+step)}}else{sar=Math.max(sar,cs[i-1].high,cs[i-2].high);if(cs[i].high>sar){up=true;sar=ep;ep=cs[i].high;af=step}else if(cs[i].low<ep){ep=cs[i].low;af=Math.min(maxAF,af+step)}}out.push(sar)}return out}
function rsiSeries(closes,p=14){const a=Array(closes.length).fill(NaN);if(closes.length<=p)return a;let g=0,l=0;for(let i=1;i<=p;i++){const d=closes[i]-closes[i-1];g+=Math.max(d,0);l+=Math.max(-d,0)}g/=p;l/=p;const v=()=>l===0?(g===0?50:100):100-100/(1+g/l);a[p]=v();for(let i=p+1;i<closes.length;i++){const d=closes[i]-closes[i-1];g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p;a[i]=v()}return a}
function heikin(cs){const out=[];cs.forEach((c,i)=>{const close=(c.open+c.high+c.low+c.close)/4,open=i?(out[i-1].open+out[i-1].close)/2:(c.open+c.close)/2;out.push({open,close,high:Math.max(c.high,open,close),low:Math.min(c.low,open,close)})});return out}
function check(){
 const selected=el('strategySelect').value;
 el('strategySettings').textContent='';
 const configs={psar:'Bollinger 20 / deviation 2; PSAR AF 0.02–0.2; PDF chart 1–2 min, expiry under 5 min.',ao:'Awesome Oscillator SMA 5 / 34 (median prices); RSI period 14, 50 crossing; PDF chart 15 sec / expiry 1 min; also mentions chart 1 min / expiry 4–5 min.',ha:'Heikin Ashi chart: blue/up candle versus red/down candle; large bodies and small shadows suggest stronger trend. No fixed expiry specified.',range:'Color Ribbons is a DRT range strategy for Crypto IDX. PDF specifies automatic 1-minute timeframe and expiry; needs support/resistance and repeated bounces.'};
 el('strategySettings').textContent=configs[selected];
 const liveMode=!!el('useLiveForStrategy')?.checked;
 if(liveMode && selected==='range'){result('WAIT — unsupported external source','Color Ribbons / DRT is specific to Binomo Crypto IDX. Binance BTC/USDT cannot verify DRT range colors or expiry. Disable live mode to review your screenshot manually.');return;}
 if(liveMode && !window.chartSignalLiveReady?.()){result('WAIT — live data unavailable','Connect Binance BTC/USDT and wait for fresh closed candles. No fallback to screenshot data while live mode is selected.');return;}
 const cs=((liveMode?window.chartSignalLiveCandles?.():window.chartSignalGetCandles?.()) || []).map(c=>({open:+c.open,high:+c.high,low:+c.low,close:+c.close}));
 if(!cs.length){result('WAIT — no candles','Upload a chart, detect candles, and review their OHLC values first.');return}
 if(cs.some(c=>!Object.values(c).every(Number.isFinite)||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.low>c.high)){result('WAIT — invalid OHLC','Correct the highlighted candle table values before checking a strategy.');return}
 const tf=num('chartTimeframe'),expiry=num('tradeExpiry');
 const note=liveMode?' Source: Binance BTC/USDT spot CLOSED candles, not Binomo. This is not a live trade-entry signal.':' Screenshot-derived OHLC is approximate; this is not a live entry signal.';
 if(selected==='psar'){
  if(cs.length<22){result('WAIT — insufficient candles','PSAR + Bollinger requires at least 22 reviewed candles.'+note);return}
  const bands=bb(cs,20,2),sar=psar(cs,.02,.2),i=cs.length-1,prev=cs[i-1],curr=cs[i],midPrev=bands[i-1]?.mid,mid=bands[i].mid;
  const crossUp=Number.isFinite(midPrev)&&prev.close<=midPrev&&curr.close>mid,crossDown=Number.isFinite(midPrev)&&prev.close>=midPrev&&curr.close<mid;
  const above=Number.isFinite(sar[i])&&sar[i]<curr.low,below=Number.isFinite(sar[i])&&sar[i]>curr.high;
  const verdict=above&&crossUp?'UP conditions matched':below&&crossDown?'DOWN conditions matched':'WAIT — conditions not aligned';
  result(verdict,`SAR ${fmt(sar[i])}; Bollinger midline ${fmt(mid)}; upward cross ${crossUp?'yes':'no'}; downward cross ${crossDown?'yes':'no'}. PDF: 1–2 min chart, expiry under 5 min. Current ${tf}s / ${expiry}s.${note}`,verdict.startsWith('UP')?'up':verdict.startsWith('DOWN')?'down':'wait');
 }else if(selected==='ao'){
  if(cs.length<36){result('WAIT — insufficient candles','AO (34-period slow SMA) and RSI crossover require at least 36 reviewed candles.'+note);return}
  const med=cs.map(c=>(c.high+c.low)/2),a=sma(med,5),b=sma(med,34),ao=a.map((x,i)=>x-b[i]),r=rsiSeries(cs.map(c=>c.close),14),i=cs.length-1;
  const up=r[i-1]<=50&&r[i]>50&&ao[i-1]<=0&&ao[i]>0&&ao[i]>ao[i-1];
  const down=r[i-1]>=50&&r[i]<50&&ao[i-1]>=0&&ao[i]<0&&ao[i]<ao[i-1];
  const verdict=up?'UP conditions matched':down?'DOWN conditions matched':'WAIT — crossover conditions not aligned';
  result(verdict,`RSI ${fmt(r[i-1])} → ${fmt(r[i])}; AO ${fmt(ao[i-1])} → ${fmt(ao[i])}. Requires RSI 50 crossover and AO zero-line crossover in the same last candle. PDF: 15s chart / 60s expiry, or 60s chart / 240–300s expiry. Current ${tf}s / ${expiry}s.${note}`,up?'up':down?'down':'wait');
 }else if(selected==='ha'){
  if(cs.length<3){result('WAIT — insufficient candles','Heikin Ashi needs at least three candles.'+note);return}
  const h=heikin(cs),c=h.at(-1),body=Math.abs(c.close-c.open),span=Math.max(.00001,c.high-c.low),upper=c.high-Math.max(c.open,c.close),lower=Math.min(c.open,c.close)-c.low;
  const bullish=c.close>c.open,bearish=c.close<c.open,strong=body/span>=.55&&Math.min(upper,lower)/span<=.15;
  const verdict=!strong?'WAIT — weak or uncertain candle':bullish?'UP trend condition matched':bearish?'DOWN trend condition matched':'WAIT — doji';
  result(verdict,`Calculated Heikin Ashi: open ${fmt(c.open)}, close ${fmt(c.close)}, body/range ${(100*body/span).toFixed(0)}%, upper shadow ${fmt(upper)}, lower shadow ${fmt(lower)}. PDF asks for a Heikin Ashi chart and emphasizes large bodies / small shadows. This reconstruction from ordinary candles is approximate.${note}`,verdict.startsWith('UP')?'up':verdict.startsWith('DOWN')?'down':'wait');
 }else{
  const support=Number(el('supportLevel').value),resistance=Number(el('resistanceLevel').value),s=el('supportLevel').value,r=el('resistanceLevel').value;
  if(s===''||r===''||!Number.isFinite(support)||!Number.isFinite(resistance)||support>=resistance){result('WAIT — enter range levels','Enter valid support and resistance values from the same chart scale. These cannot be inferred reliably from screenshot pixel prices.');return}
  const tolerance=(resistance-support)*.08,nearSupport=cs.filter(c=>Math.abs(c.low-support)<=tolerance).length,nearResistance=cs.filter(c=>Math.abs(c.high-resistance)<=tolerance).length,last=cs.at(-1),inRange=last.close>=support&&last.close<=resistance;
  const lastMove=Math.abs(last.close-last.open),range=resistance-support,sharp=lastMove>range*.4;
  const verdict=inRange&&nearSupport>=2&&nearResistance>=2&&!sharp?'Range conditions present — direction unverified':'WAIT — range conditions incomplete';
  result(verdict,`Support touches ~${nearSupport}, resistance touches ~${nearResistance}; last close inside range: ${inRange?'yes':'no'}; sharp last move: ${sharp?'yes':'no'}. PDF: DRT on Crypto IDX, automatic 1-minute timeframe/expiry. Range colors and actual DRT outcome cannot be verified from OHLC alone.${note}`);
 }
 if(liveMode){el('strategyFreshness').textContent='Binance external feed: '+(window.chartSignalLiveFreshness?.()||'unverified')+'; not a Binomo signal.';return;}
 const cap=el('captureTime').value;
 if(!cap){el('strategyFreshness').textContent='Capture time missing: strategy match is NOT verified as current.'}
 else{const age=(Date.now()-new Date(cap).getTime())/1000;el('strategyFreshness').textContent=!Number.isFinite(age)||age<0||age>tf?`Screenshot stale or invalid (${Math.round(age)} seconds old). Do not treat this as current.`:`Screenshot entered ${Math.round(age)} seconds ago. Timestamp is user-provided, not verified by Binomo.`}
}
el('strategySelect').addEventListener('change',()=>{el('rangeInputs').hidden=el('strategySelect').value!=='range';el('strategySettings').textContent='Click Check Strategy to inspect settings and conditions.';result('Not checked','Review candles and press Check Strategy.');});
el('checkStrategyBtn').addEventListener('click',()=>{try{check()}catch(e){console.error('V6 strategy error',e);result('WAIT — strategy error',e.message)}});
el('strategySelect').dispatchEvent(new Event('change'));
})();
