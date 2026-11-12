/* Extra standalone analysis. It never modifies existing V5.2 results or trade directions. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), U='#14d59f',D='#ff637c',N='#bbcadc',W='#ffc04d';
 let dataset=null, visible=55, offset=0, pointerDown=null;
 const validNumber=x=>Number.isFinite(x);
 const average=v=>v.reduce((a,b)=>a+b,0)/Math.max(1,v.length);
 const fmt=x=>!validNumber(x)?'—':dataset?.source==='screenshot'?x.toFixed(1):Math.abs(x)>=100?x.toFixed(3):x.toFixed(5);
 const indicator=(key,headline,details,tone)=>{
   const v=$('adv'+key),i=$('adv'+key+'Info');if(v){v.textContent=headline;v.style.color=tone||'#e5f2ff';}if(i)i.textContent=details;
 };
 function reset(note){dataset=null;offset=0;indicator('Aroon','NO DATA','Needs 26 closed candles');indicator('Donchian','NO DATA','Needs 21 closed candles');indicator('Chop','NO DATA','Needs 15 closed candles');indicator('Keltner','NO DATA','Needs 30 closed candles');$('advSource').textContent=note||'Upload a Binomo screenshot for analysis.';$('advRange').textContent='No candle data';draw();}
 function aroon(rows,period=25){
  if(rows.length<period+1)return null;
  const a=rows.slice(-period);let hi=0,lo=0;
  for(let j=1;j<a.length;j++){if(a[j][2]>=a[hi][2])hi=j;if(a[j][3]<=a[lo][3])lo=j;}
  const up=100*(period-(a.length-1-hi))/period,down=100*(period-(a.length-1-lo))/period;
  return {up,down};
 }
 function donchian(rows,period=20,i=rows.length-1){
  if(i<period)return null;const prev=rows.slice(i-period,i);return {upper:Math.max(...prev.map(r=>r[2])),lower:Math.min(...prev.map(r=>r[3]))};
 }
 function tr(rows,i){const r=rows[i],prev=i?rows[i-1][4]:r[4];return Math.max(r[2]-r[3],Math.abs(r[2]-prev),Math.abs(r[3]-prev));}
 function choppiness(rows,period=14){
  if(rows.length<period+1)return null;
  const tail=rows.slice(-period),start=rows.length-period;
  const sum=tail.reduce((acc,r,j)=>acc+tr(rows,start+j),0),range=Math.max(...tail.map(r=>r[2]))-Math.min(...tail.map(r=>r[3]));
  if(!(range>0&&sum>0))return null;
  return Math.min(100,Math.max(0,100*Math.log10(sum/range)/Math.log10(period)));
 }
 function keltnerSeries(rows){
  const es=[],av=[],up=[],low=[];let e=NaN,atr=NaN;
  for(let i=0;i<rows.length;i++){
   const close=rows[i][4],t=tr(rows,i);
   e=!validNumber(e)?close:e+(close-e)*2/21;
   atr=!validNumber(atr)?t:atr+(t-atr)/10;
   es.push(i>=29?e:NaN);av.push(i>=29?atr:NaN);
   up.push(i>=29?e+1.5*atr:NaN);low.push(i>=29?e-1.5*atr:NaN);
  }
  return {mid:es,upper:up,lower:low};
 }
 function analyze(){
  if(!dataset)return;const rows=dataset.rows,n=rows.length,close=rows[n-1][4];
  const ar=aroon(rows);if(!ar)indicator('Aroon','INSUFFICIENT DATA',`${n}/26 completed candles`,W);
  else indicator('Aroon',ar.up>ar.down+12?'UP TREND':ar.down>ar.up+12?'DOWN TREND':'MIXED',`Up ${ar.up.toFixed(0)} · Down ${ar.down.toFixed(0)} (0–100)`,ar.up>ar.down+12?U:ar.down>ar.up+12?D:W);
  const dc=donchian(rows);if(!dc)indicator('Donchian','INSUFFICIENT DATA',`${n}/21 completed candles`,W);
  else indicator('Donchian',close>dc.upper?'BREAKOUT UP':close<dc.lower?'BREAKOUT DOWN':'IN RANGE',`Prev 20 high ${fmt(dc.upper)} · low ${fmt(dc.lower)}`,close>dc.upper?U:close<dc.lower?D:N);
  const ch=choppiness(rows);if(ch===null)indicator('Chop','INSUFFICIENT DATA',`${n}/15 completed candles (or zero price range)`,W);
  else indicator('Chop',ch>=61.8?'CHOPPY':ch<=38.2?'TRENDING':'MIXED',`Index ${ch.toFixed(1)} · not a direction`,ch>=61.8?W:N);
  if(n<30)indicator('Keltner','INSUFFICIENT DATA',`${n}/30 completed candles`,W);
  else {const kb=keltnerSeries(rows),up=kb.upper[n-1],lo=kb.lower[n-1];indicator('Keltner',close>up?'ABOVE BAND':close<lo?'BELOW BAND':'IN CHANNEL',`EMA20 ±1.5 × ATR10 · ${fmt(lo)} to ${fmt(up)}`,close>up?U:close<lo?D:N);}
  const source=dataset.source==='csv'?'Authorized OHLC CSV':'Binomo screenshot pixel estimate';
  $('advSource').textContent=`${source} · ${n} completed candles · ${new Date(dataset.at).toLocaleTimeString()} · no live Binomo connection`;
  draw();
 }
 const cssChartSize=()=>{
   const c=$('advCandleCanvas'),wrap=c.parentElement;
   const w=Math.max(260,Math.floor(wrap.getBoundingClientRect().width-2)),h=w<520?216:305;
   const dpr=Math.min(2,window.devicePixelRatio||1);c.width=Math.floor(w*dpr);c.height=Math.floor(h*dpr);
   c.style.width=w+'px';c.style.height=h+'px';const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w,h};
 };
 function draw(){
  const c=$('advCandleCanvas');if(!c)return;
  const {ctx,w,h}=cssChartSize();ctx.fillStyle='#0a1525';ctx.fillRect(0,0,w,h);
  if(!dataset?.rows?.length){ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillStyle='#a9bfd2';ctx.fillText('Waiting for completed candle data',w/2,h/2);return;}
  const rows=dataset.rows,showCount=Math.min(visible,rows.length),end=Math.max(showCount,rows.length-offset),start=end-showCount,s=rows.slice(start,end);
  const padL=11,padR=62,padT=20,padB=35,CW=w-padL-padR,CH=h-padT-padB;
  if(CW<50||CH<50)return;
  const dcLines=s.map((r,k)=>donchian(rows,20,start+k));const kc=keltnerSeries(rows);
  let ys=s.flatMap(r=>[r[2],r[3]]);
  if($('advDonchianToggle').checked)for(const d of dcLines)if(d)ys.push(d.upper,d.lower);
  if($('advKeltnerToggle').checked)for(let i=start;i<end;i++)if(validNumber(kc.upper[i]))ys.push(kc.upper[i],kc.lower[i]);
  let yMin=Math.min(...ys),yMax=Math.max(...ys);let gap=Math.max((yMax-yMin)*.1,Math.abs(yMax)*.0001,0.00001);yMin-=gap;yMax+=gap;
  const x=i=>padL+(i+.5)*(CW/s.length),y=v=>padT+((yMax-v)/(yMax-yMin))*CH;
  ctx.lineWidth=1;ctx.font='10px system-ui';ctx.textAlign='left';
  for(let k=0;k<=4;k++){const value=yMax-(yMax-yMin)*k/4,yy=y(value);ctx.strokeStyle='#283b51';ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(padL+CW,yy);ctx.stroke();ctx.fillStyle='#8ba6bc';ctx.fillText(fmt(value),padL+CW+5,yy+3);}
  const line=(arr,color)=>{ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();let begun=false;for(let k=0;k<arr.length;k++){const v=arr[k];if(!validNumber(v)){begun=false;continue;}if(!begun){ctx.moveTo(x(k),y(v));begun=true;}else ctx.lineTo(x(k),y(v));}ctx.stroke();};
  if($('advDonchianToggle').checked){line(dcLines.map(d=>d?.upper??NaN),'#4da2ff');line(dcLines.map(d=>d?.lower??NaN),'#4da2ff');}
  if($('advKeltnerToggle').checked){line(kc.upper.slice(start,end),'#b689ff');line(kc.lower.slice(start,end),'#b689ff');}
  const candleW=Math.max(1.5,Math.min(10,(CW/s.length)*.67));
  s.forEach((r,i)=>{const xx=x(i),green=r[4]>=r[1];ctx.fillStyle=ctx.strokeStyle=green?U:D;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(xx,y(r[2]));ctx.lineTo(xx,y(r[3]));ctx.stroke();const top=Math.min(y(r[1]),y(r[4])),height=Math.max(1.5,Math.abs(y(r[1])-y(r[4])));ctx.fillRect(xx-candleW/2,top,candleW,height);});
  for(const k of [0,Math.floor((s.length-1)/2),s.length-1]){const idx=start+k,dd=new Date(rows[idx][0]);const text=dataset.source==='csv'?(validNumber(dd.getTime())?dd.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'C'+(idx+1)):'C'+(idx+1);ctx.fillStyle='#a5b8cc';ctx.textAlign=k===0?'left':k===s.length-1?'right':'center';ctx.fillText(text,x(k),h-12);}
  $('advRange').textContent=`Candles ${start+1}–${end} of ${rows.length}${dataset.source==='screenshot'?' · approximate':''}`;
 }
 window.addEventListener('fusion:binomo-candles',event=>{
  const d=event.detail||{};
  if(!Array.isArray(d.rows)||d.rows.length<20){reset(d.error?`Analysis unavailable: ${d.error}`:'Not enough valid completed candle data');return;}
  const rows=d.rows.filter(r=>Array.isArray(r)&&r.length>=5&&r.slice(1,5).every(validNumber)&&r[2]>=Math.max(r[1],r[4])&&r[3]<=Math.min(r[1],r[4]));
  if(rows.length<20){reset('Candle data validation failed · INSUFFICIENT DATA');return;}
  dataset={rows:rows.map(r=>r.slice(0,5)),source:d.source==='csv'?'csv':'screenshot',at:d.at||Date.now()};offset=0;analyze();
 });
 for(const id of ['advDonchianToggle','advKeltnerToggle'])$(id)?.addEventListener('change',draw);
 $('advZoomIn')?.addEventListener('click',()=>{visible=Math.max(14,visible-12);offset=Math.min(offset,Math.max(0,(dataset?.rows.length||0)-visible));draw();});
 $('advZoomOut')?.addEventListener('click',()=>{visible=Math.min(150,visible+12);offset=Math.min(offset,Math.max(0,(dataset?.rows.length||0)-visible));draw();});
 $('advReset')?.addEventListener('click',()=>{offset=0;visible=55;draw();});
 const chart=$('advCandleCanvas');chart?.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,offset};chart.setPointerCapture?.(e.pointerId);});
 chart?.addEventListener('pointermove',e=>{if(!pointerDown||!dataset)return;const pixelsPerCandle=chart.getBoundingClientRect().width/Math.min(visible,dataset.rows.length);const shift=Math.round((e.clientX-pointerDown.x)/Math.max(3,pixelsPerCandle));const max=Math.max(0,dataset.rows.length-Math.min(visible,dataset.rows.length));offset=Math.min(max,Math.max(0,pointerDown.offset+shift));draw();});
 chart?.addEventListener('pointerup',()=>{pointerDown=null;});chart?.addEventListener('pointercancel',()=>{pointerDown=null;});
 $('advancedChartAnalysis')?.addEventListener('toggle',()=>{if($('advancedChartAnalysis').open)requestAnimationFrame(draw);});
 window.addEventListener('resize',()=>{if($('advancedChartAnalysis')?.open)draw();});
 reset();
})();
