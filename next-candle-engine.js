/* Crypto 10 Fusion add-on: next-candle timing, research filter, quality guard, local journal. */
/* This module does not change the Smart Candle Assistant V5.2 formulas or automatically place trades. */
(()=>{'use strict';
const $=id=>document.getElementById(id),M=60000,KEY='crypto10-nextcandle-v1-journal';
const COLORS={UP:'#15d8a3',DOWN:'#fb637d',WAIT:'#c0d0e2'};
let dataset=null,entry=null,lockId='',lastUploadAt=0,captureAt=0,captureTrusted=false,backtestData=null;
let journal=[];try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');journal=Array.isArray(raw)?raw.slice(-600):[];}catch(_){}
const rounded=t=>Math.floor(t/M)*M;
const hh=t=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(t));
const ss=t=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date(t));
const put=(id,t)=>{const e=$(id);if(e)e.textContent=String(t);};
const median=v=>{const s=v.filter(Number.isFinite).sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:NaN;};
const mean=v=>v.reduce((a,b)=>a+b,0)/Math.max(1,v.length);
function ema(v,n){let p=NaN;return v.map(x=>{p=Number.isFinite(p)?p+(x-p)*2/(n+1):x;return p;});}
function rsi(v,n=14){if(v.length<n+1)return NaN;let g=0,l=0;for(let i=1;i<=n;i++){const d=v[i]-v[i-1];g+=Math.max(d,0);l+=Math.max(-d,0);}g/=n;l/=n;for(let i=n+1;i<v.length;i++){let d=v[i]-v[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;}return l===0?(g?100:50):100-100/(1+g/l);}
function decide(rows){
 const n=rows.length;if(n<50)return {dir:'WAIT',reason:`Need 50 completed candles; currently ${n}.`,score:0,up:0,down:0};
 const closes=rows.map(r=>r[4]),e9=ema(closes,9),e21=ema(closes,21),e12=ema(closes,12),e26=ema(closes,26);
 const mac=e12.map((v,i)=>v-e26[i]),sig=ema(mac,9),i=n-1,price=closes[i],last=rows[i];
 const trueRanges=rows.slice(1).map((r,j)=>Math.max(r[2]-r[3],Math.abs(r[2]-rows[j][4]),Math.abs(r[3]-rows[j][4])));
 const atr=mean(trueRanges.slice(-14));
 const recent=rows.slice(-15),ranges=recent.map(r=>r[2]-r[3]),typical=median(ranges),lastRange=last[2]-last[3];
 const rs=rsi(closes),prior=rows.slice(-21,-1),resistance=Math.max(...prior.map(r=>r[2])),support=Math.min(...prior.map(r=>r[3]));
 let up=0,down=0;const votes=[];
 const add=(name,dir)=>{votes.push(name+': '+(dir>0?'UP':dir<0?'DOWN':'neutral'));if(dir>0)up++;if(dir<0)down++;};
 add('EMA trend',e9[i]>e21[i]&&e9[i]>e9[i-2]?1:e9[i]<e21[i]&&e9[i]<e9[i-2]?-1:0);
 const hist=mac[i]-sig[i],histPrev=mac[i-1]-sig[i-1];add('MACD',hist>0&&hist>histPrev?1:hist<0&&hist<histPrev?-1:0);
 add('RSI',rs>=53&&rs<=70?1:rs<=47&&rs>=30?-1:0);
 add('Closed candles',closes[i]>closes[i-1]&&closes[i-1]>=closes[i-2]?1:closes[i]<closes[i-1]&&closes[i-1]<=closes[i-2]?-1:0);
 add('Price vs EMA',price>e9[i]+atr*.04?1:price<e9[i]-atr*.04?-1:0);
 let dir=up>=4&&down<=1?'UP':down>=4&&up<=1?'DOWN':'WAIT';
 const block=[];
 if(!Number.isFinite(atr)||atr<=0||typical<=0)block.push('Missing usable volatility data');
 if(lastRange>typical*2.5)block.push('Unusually large latest candle');
 if(lastRange<typical*.2)block.push('Near-flat latest candle');
 const closeVar=mean(closes.slice(-15).map(v=>Math.abs(v-mean(closes.slice(-15)))));
 if(closeVar<atr*.28)block.push('Choppy / sideways market');
 if(dir==='UP'&&Number.isFinite(resistance)&&price<=resistance&&price>=resistance-atr*.65)block.push('Near prior resistance');
 if(dir==='DOWN'&&Number.isFinite(support)&&price>=support&&price<=support+atr*.65)block.push('Near prior support');
 if(block.length)dir='WAIT';
 const reason=dir==='WAIT'?(block.length?block.join('; '):`Conflicting rules (${up} UP / ${down} DOWN)`):`Research bias ${dir} (${up} UP / ${down} DOWN rules); not a verified probability`;
 return {dir,reason,up,down,votes,score:Math.max(up,down),atr};
}
function getInterval(rows){if(rows.length<2)return M;return median(rows.slice(-Math.min(30,rows.length)).slice(1).map((r,i,a)=>r[0]-rows[rows.length-a.length-1+i][0]));}
function save(){try{localStorage.setItem(KEY,JSON.stringify(journal.slice(-600)));}catch(_){put('ncJournalNote','Storage unavailable: journal will be lost when page closes.');}}
function renderJournal(){
 const shown=journal.slice().reverse().slice(0,12),list=$('ncJournalList');if(!list)return;list.textContent='';
 if(!shown.length){list.textContent='No signals logged yet. UP/DOWN research signals are logged automatically; record outcomes manually or import later matching OHLC.';}
 for(const r of shown){const item=document.createElement('div');item.className='nc-journal-line';
  const tag=document.createElement('div');tag.textContent=`${r.dir} · ${hh(r.target)} · ${r.source.toUpperCase()}`;tag.style.fontWeight='750';
  const status=document.createElement('small');status.textContent=r.outcome?`${r.outcome} · ${r.method||'manual'}`:'Outcome pending';
  const actions=document.createElement('div');actions.className='nc-journal-actions';
  for(const st of ['WIN','LOSS','TIE']){const btn=document.createElement('button');btn.type='button';btn.textContent=st;btn.className=r.outcome===st?'nc-active':'';btn.addEventListener('click',()=>{r.outcome=st;r.method='manual';save();renderJournal();});actions.append(btn);}
  item.append(tag,status,actions);list.append(item);
 }
 const resolved=journal.filter(r=>r.outcome),wins=resolved.filter(r=>r.outcome==='WIN').length,losses=resolved.filter(r=>r.outcome==='LOSS').length,ties=resolved.filter(r=>r.outcome==='TIE').length;
 put('ncJournalStats',`${journal.length} logged · ${wins} win / ${losses} loss / ${ties} tie · ${resolved.length?Math.round(100*wins/resolved.length)+'% recorded wins':'no verified win rate'} (manual or CSV results)`);
}
function applyCsvOutcomes(rows){
 const byTime=new Map(rows.map(r=>[r[0],r]));let changed=0;
 for(const j of journal){if(j.source!=='csv'||j.outcome)continue;const bar=byTime.get(j.target);if(!bar||Date.now()<j.target+M)continue;
  const actual=bar[4]>bar[1]?'UP':bar[4]<bar[1]?'DOWN':'TIE';j.outcome=actual==='TIE'?'TIE':actual===j.dir?'WIN':'LOSS';j.method='matched later CSV';changed++;
 }if(changed){save();renderJournal();put('ncJournalNote',`${changed} older imported-CSV signal outcome(s) checked against newly supplied matching candle timestamps.`);}
}
function logSignal(dir,target,source,reason){const id=`${source}:${target}:${dir}`;if(id===lockId)return;lockId=id;
 if(journal.some(r=>r.source===source&&r.target===target))return;
 journal.push({id,target,dir,source,reason,created:Date.now(),outcome:null});journal=journal.slice(-600);save();renderJournal();
}
function show(dir,headline,reason,meta,valid=false){
 put('ncDirection',dir);const el=$('ncDirection');if(el){el.style.color=COLORS[dir]||COLORS.WAIT;el.className='nc-decision '+dir.toLowerCase();}
 put('ncHeadline',headline);put('ncReason',reason);put('ncData',meta);$('ncBadge').textContent=valid?'TIMED RESEARCH':'NO ACTIONABLE SIGNAL';
}
function preview(){
 const now=Date.now(),start=rounded(now),next=start+M;
 put('ncClock',ss(now));put('ncNextBoundary',hh(next));put('ncResultClock',hh(next+M));
 if(!dataset){put('ncLastClose','—');put('ncTarget',`${hh(next)} – ${hh(next+M)}`);show('WAIT','Upload data first','Choose a fresh screenshot or import 1-minute OHLC CSV. Screenshot candles are estimates.','No validated data');return;}
 const d=dataset,rows=d.rows,analysis=d.estimated,quality=d.quality||'',isCSV=d.source==='csv';
 const target=isCSV?rows[rows.length-1][0]+M:(d.at-rounded(d.at)<9000?rounded(d.at):rounded(d.at)+M),targetEnd=target+M;
 put('ncTarget',`${hh(target)} – ${hh(targetEnd)}`);put('ncResultClock',hh(targetEnd));
 put('ncLastClose',isCSV?hh(rows[rows.length-1][0]+M):'Time unverified (pixel estimate)');
 put('ncCount',`${rows.length} closed · ${d.source==='csv'?'imported CSV':'pixel estimate'}${d.preset?' · '+d.preset+' crop':''}`);
 const timeRemaining=Math.max(0,Math.ceil((target+9000-now)/1000));
 put('ncEntryWindow',now<target?`Not started; refresh after ${hh(target)}`:now>=target+9000?'Expired / late':`${timeRemaining}s early-candle window`);
 const result=decide(rows);
 const problems=[];
 if(d.source==='screenshot'){
  if(!captureTrusted)problems.push('Confirm screenshot was captured right after this minute started');
  if(captureAt&&Date.now()-captureAt>20000)problems.push('Photo file is older than 20 seconds; take a new screenshot');
  if(!Number.isFinite(d.at)||Date.now()-d.at>9000)problems.push('Screenshot analysis is too old for this candle');
  if(rows.length<35)problems.push('Too few screenshot-derived candles');
  if(quality==='LOW CONFIDENCE')problems.push('Unreliable pixel extraction');
 }else if(rows.length<50)problems.push('Need 50 1m closed candles for research filter');
 if(isCSV){const tf=getInterval(rows);if(tf!==M||rows.slice(-10).some((r,i,a)=>i>0&&r[0]-a[i-1][0]!==M))problems.push('Recent OHLC timestamps are not consecutive 1-minute candles');}
 if(now<target)problems.push('Target candle has not opened: take a NEW screenshot right after it opens');
 if(now>=target+9000)problems.push('Signal late: first 9 seconds of target candle passed');
 if(now>=target+M)problems.push('Target candle already ended');
 const decision=problems.length?'WAIT':result.dir;
 const reason=[...problems,result.reason].filter(Boolean).join(' · ');
 const meta=`${isCSV?'Imported timestamped OHLC':'Unverified screenshot pixels'} · ${rows.length} closed candles · ${result.up||0} UP / ${result.down||0} DOWN rule votes`;
 show(decision,decision==='WAIT'?'WAIT · '+(problems.length?'TIMING / DATA CHECK':'RULES DISAGREE'):`${decision} · RESEARCH SIGNAL`,reason,meta,decision!=='WAIT');
 if(decision!=='WAIT')logSignal(decision,target,d.source,result.reason);
}
function renderFailure(err){dataset=null;captureTrusted=false;$('ncFreshConfirm').checked=false;put('ncCount','NO DATA');put('ncLastClose','—');put('ncJournalNote',`Candle reading: ${err}`);show('WAIT','WAIT · DATA ERROR',err+' · Screenshot paste success does not prove candles were read.','No candles available');}
function backtest(rows){
 let total=0,win=0,loss=0,tie=0,signal=0;
 if(rows.length<55)return 'Backtest needs at least 55 timestamped 1-minute completed candles.';
 for(let k=50;k<rows.length;k++){
  if(rows[k][0]-rows[k-1][0]!==M)continue;
  const r=decide(rows.slice(0,k));total++;if(r.dir==='WAIT')continue;signal++;
  const actual=rows[k][4]>rows[k][1]?'UP':rows[k][4]<rows[k][1]?'DOWN':'TIE';
  if(actual==='TIE')tie++;else if(actual===r.dir)win++;else loss++;
 }
 return signal?`${win} win / ${loss} loss / ${tie} tie · ${signal} signals from ${total} tested candles · ${Math.round(100*win/signal)}% observed win proportion. Historical only; not out-of-sample and no guarantee.`:`No UP/DOWN signals over ${total} tested candles (filters mostly WAIT). Try longer clean CSV, not screenshot data.`;
}
function onData(e){const d=e.detail||{};if(!Array.isArray(d.rows)||d.rows.length<20){renderFailure(d.error||'Not enough identifiable completed candles');return;}
 const rows=d.rows.filter(r=>Array.isArray(r)&&r.length>=5&&r.slice(1,5).every(Number.isFinite)).map(r=>r.slice(0,5));if(rows.length<20){renderFailure('Invalid candle levels');return;}
 const source=d.source==='csv'?'csv':'screenshot';dataset={rows,source,at:d.at||Date.now(),preset:d.preset||'',quality:d.quality||'',estimated:source==='screenshot'};
 if(source==='screenshot'){
  const file=$('shotFile')?.files?.[0];captureAt=file?.lastModified||0;
  // Recent photo metadata is only a freshness hint, not proof of correct chart candles.
  captureTrusted=!!(captureAt&&Math.abs(Date.now()-captureAt)<=10000);$('ncFreshConfirm').checked=captureTrusted;
  put('ncCaptureInfo',captureAt&&Math.abs(captureAt-Date.now())<10*M?`Photo file modified ${ss(captureAt)} · not a verified chart clock`:'Capture time unknown (paste/file metadata not trustworthy)');
 }else{captureTrusted=true;put('ncCaptureInfo','CSV candle timestamps accepted after completion check; source is user-supplied.');
  applyCsvOutcomes(rows);put('ncBacktest',backtest(rows));}
 put('ncDataError','');preview();
}
window.addEventListener('fusion:binomo-candles',onData);
$('ncFreshConfirm')?.addEventListener('change',e=>{captureTrusted=!!e.target.checked;preview();});
$('ncCrop')?.addEventListener('change',()=>{
 captureTrusted=false;$('ncFreshConfirm').checked=false;
 if($('shotPreview')?.complete&&$('shotPreview')?.naturalWidth){$('estimateBinomo')?.click();}else{put('ncDataError','Select a screenshot to apply the crop.');}
});
$('ncRetry')?.addEventListener('click',()=>{if($('shotPreview')?.complete&&$('shotPreview')?.naturalWidth){$('estimateBinomo')?.click();}else{put('ncDataError','Select a screenshot first.');}});
$('ncBacktestBtn')?.addEventListener('click',()=>{put('ncBacktest',dataset?.source==='csv'?backtest(dataset.rows):'Use timestamped 1-minute OHLC CSV for backtesting; a screenshot does not provide verified history.');});
$('ncExport')?.addEventListener('click',()=>{const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[['TargetTimeIST','Direction','Source','CapturedAtISO','Outcome','OutcomeMethod','Reason'].join(',')];
 for(const j of journal)rows.push([hh(j.target),j.dir,j.source,new Date(j.created).toISOString(),j.outcome||'',j.method||'',j.reason].map(esc).join(','));
 const url=URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='crypto10-nextcandle-journal.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
});
$('ncClear')?.addEventListener('click',()=>{if(!window.confirm('Delete all local Next Candle Monitor journal entries on this browser?'))return;journal=[];save();renderJournal();put('ncJournalNote','Local journal cleared.');});
setInterval(preview,1000);renderJournal();preview();
})();
