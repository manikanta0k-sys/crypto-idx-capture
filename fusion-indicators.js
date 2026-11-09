/* Fusion V3.1 — real OHLC indicator computations, educational use only. */
(()=>{'use strict';
const coins=['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','LINK','AVAX','LTC'];
const names=['EMA','MACD','RSI','Supertrend','ADX + DI','Bollinger Bands','Stochastic RSI','Parabolic SAR','CCI','Williams %R','Momentum','Awesome Oscillator','Fractals','Moving Average','Fractal Chaos Bands','Alligator','ATR','Stochastic'];
const colors=['#16c79a','#ff5874','#a7b6ce'];
const el=id=>document.getElementById(id),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const last=a=>a[a.length-1];
const sma=(a,n)=>a.map((_,i)=>i>=n-1?mean(a.slice(i-n+1,i+1)):NaN);
function ema(a,n){let prev=NaN;return a.map(x=>{if(!Number.isFinite(x))return prev;if(!Number.isFinite(prev))prev=x;else prev=prev+(x-prev)*2/(n+1);return prev;});}
const diff=(a,b)=>a.map((x,i)=>x-b[i]);
function rsi(c,n=14){const d=c.slice(1).map((v,i)=>v-c[i]);let g=0,l=0;const out=Array(c.length).fill(NaN);if(d.length<n)return out;for(let i=0;i<n;i++){g+=Math.max(d[i],0);l+=Math.max(-d[i],0)}g/=n;l/=n;for(let i=n;i<c.length;i++){if(i>n){g=(g*(n-1)+Math.max(d[i-1],0))/n;l=(l*(n-1)+Math.max(-d[i-1],0))/n;}out[i]=l===0?(g===0?50:100):100-100/(1+g/l);}return out;}
function atr(h,l,c,n=14){const tr=c.map((v,i)=>i?Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])):h[i]-l[i]);return ema(tr,n);}
function adx(h,l,c,n=14){const plus=[0],minus=[0];for(let i=1;i<c.length;i++){const up=h[i]-h[i-1],dn=l[i-1]-l[i];plus.push(up>dn&&up>0?up:0);minus.push(dn>up&&dn>0?dn:0);}const a=atr(h,l,c,n),p=ema(plus,n).map((x,i)=>100*x/(a[i]||1)),m=ema(minus,n).map((x,i)=>100*x/(a[i]||1));const dx=p.map((x,i)=>100*Math.abs(x-m[i])/(x+m[i]||1));return {p,m,adx:ema(dx,n)};}
const decide=(x,y,band=0)=>!Number.isFinite(x)||!Number.isFinite(y)?0:x>y+band?1:x<y-band?-1:0;
function classify(rows){const h=rows.map(x=>x[2]),l=rows.map(x=>x[3]),c=rows.map(x=>x[4]),n=c.length;if(n<70)throw Error('Not enough completed candles');const e9=ema(c,9),e21=ema(c,21),e12=ema(c,12),e26=ema(c,26),mac=diff(e12,e26),signal=ema(mac,9),r=rsi(c),a=atr(h,l,c),di=adx(h,l,c),s20=sma(c,20),s50=sma(c,50),mid=h.map((v,i)=>(v+l[i])/2),ao=diff(sma(mid,5),sma(mid,34));const i=n-1,price=c[i],vol=a[i]||price*.001;let result={};
result['EMA']=decide(e9[i],e21[i]);result['Moving Average']=decide(s20[i],s50[i]);result['MACD']=decide(mac[i],signal[i],Math.abs(mac[i])*.02);result['RSI']=r[i]>55?1:r[i]<45?-1:0;
result['Momentum']=decide(price,c[i-10],vol*.12);result['Awesome Oscillator']=decide(ao[i],0,vol*.03);
result['ADX + DI']=di.adx[i]<20?0:decide(di.p[i],di.m[i],2);
const sd=Math.sqrt(mean(c.slice(i-19,i+1).map(x=>(x-s20[i])**2)));result['Bollinger Bands']=price>s20[i]+sd*.25?1:price<s20[i]-sd*.25?-1:0;
const typical=c.map((x,j)=>(h[j]+l[j]+x)/3),tm=sma(typical,20),dev=mean(typical.slice(i-19,i+1).map(x=>Math.abs(x-tm[i])));const cci=(typical[i]-tm[i])/(.015*(dev||1));result['CCI']=cci>100?1:cci< -100?-1:0;
const hi14=Math.max(...h.slice(i-13,i+1)),lo14=Math.min(...l.slice(i-13,i+1)),wr=-100*(hi14-price)/(hi14-lo14||1);result['Williams %R']=wr> -40?1:wr< -60?-1:0;
const stoch=(price-lo14)/(hi14-lo14||1)*100;result['Stochastic']=stoch>60?1:stoch<40?-1:0;
const rv=r.slice(i-13,i+1),rmin=Math.min(...rv),rmax=Math.max(...rv),sr=(r[i]-rmin)/(rmax-rmin||1)*100;result['Stochastic RSI']=sr>60?1:sr<40?-1:0;
// Wilder-style directional supertrend approximation from ATR bands and prior close.
let upper=0,lower=0,trend=1;for(let j=1;j<n;j++){const basic=(h[j]+l[j])/2,up=basic+3*a[j],dn=basic-3*a[j];if(j===1){upper=up;lower=dn;continue;}const prevUpper=upper,prevLower=lower;upper=up<prevUpper||c[j-1]>prevUpper?up:prevUpper;lower=dn>prevLower||c[j-1]<prevLower?dn:prevLower;if(c[j]>prevUpper)trend=1;else if(c[j]<prevLower)trend=-1;}result['Supertrend']=trend;
// PSAR with acceleration and extreme point.
let bull=c[1]>=c[0],sar=bull?l[0]:h[0],ep=bull?h[0]:l[0],af=.02;for(let j=2;j<n;j++){sar+=af*(ep-sar);sar=bull?Math.min(sar,l[j-1],l[j-2]):Math.max(sar,h[j-1],h[j-2]);if((bull&&l[j]<sar)||(!bull&&h[j]>sar)){bull=!bull;sar=ep;ep=bull?h[j]:l[j];af=.02;}else if((bull&&h[j]>ep)||(!bull&&l[j]<ep)){ep=bull?h[j]:l[j];af=Math.min(.2,af+.02);}}result['Parabolic SAR']=bull?1:-1;
// Confirmed 5-bar fractal pivots only, excluding last two candles.
let fh=NaN,fl=NaN;for(let j=2;j<n-2;j++){if(h[j]>h[j-1]&&h[j]>h[j-2]&&h[j]>h[j+1]&&h[j]>h[j+2])fh=h[j];if(l[j]<l[j-1]&&l[j]<l[j-2]&&l[j]<l[j+1]&&l[j]<l[j+2])fl=l[j];}result['Fractals']=Number.isFinite(fh)&&Number.isFinite(fl)?price>fh?1:price<fl?-1:0:0;
result['Fractal Chaos Bands']=result['Fractals'];
// Alligator uses smoothed median price; latest non-forward-shifted values for transparent classification.
const jaw=ema(mid,13),teeth=ema(mid,8),lips=ema(mid,5);result['Alligator']=lips[i]>teeth[i]&&teeth[i]>jaw[i]?1:lips[i]<teeth[i]&&teeth[i]<jaw[i]?-1:0;
// ATR measures volatility, not direction; intentionally WAIT.
result['ATR']=0;
return {result,closes:c,rows};}
function draw(groups,available){const root=el('agreement');if(!root)return;root.innerHTML='';for(const name of names){const votes=groups.map(g=>g.result[name]);const counts=[votes.filter(v=>v===1).length,votes.filter(v=>v===-1).length,votes.filter(v=>v===0).length],den=votes.length;const p=counts.map(v=>den?Math.round(v/den*100):0);const section=document.createElement('div');section.className='indicator-chart-group';const heading=document.createElement('div');heading.className='indicator-chart-heading';const label=document.createElement('strong');label.textContent=name;heading.append(label);const tag=document.createElement('span');tag.textContent=den?['UP','DOWN','WAIT'][counts.indexOf(Math.max(...counts))]:'NO DATA';tag.style.color=colors[counts.indexOf(Math.max(...counts))];heading.append(tag);section.append(heading);const plot=document.createElement('div');plot.className='indicator-plot';for(let k=0;k<3;k++){const col=document.createElement('div');col.className='indicator-column';const num=document.createElement('b');num.textContent=den?p[k]+'%':'—';const bar=document.createElement('div');bar.className='indicator-column-bar';bar.style.cssText=`height:${den?p[k]:0}%;background:${colors[k]};`;const cap=document.createElement('span');cap.textContent=['UP','DOWN','WAIT'][k];col.append(num,bar,cap);plot.append(col);}section.append(plot);root.append(section);}el('indicatorDataInfo').textContent=`${available}/10 coins with completed Binance candles. ATR measures volatility, so its directional classification is WAIT. Fractals and Fractal Chaos Bands share pivot logic. Percentages are coin counts, NOT predicted accuracy.`;}

function parseBinomoCsv(text){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(x=>x.trim());if(lines.length<71)throw Error('Need at least 70 completed OHLC candles.');
 const split=line=>{let out=[],cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(cur.trim());cur='';}else cur+=c;}out.push(cur.trim());return out;};
 const headers=split(lines[0]).map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''));const cols=['time','open','high','low','close'];let ix=cols.map(c=>headers.indexOf(c));if(ix[0]<0)ix[0]=headers.indexOf('timestamp');if(ix[0]<0)ix[0]=headers.indexOf('datetime');if(ix[0]<0)ix[0]=headers.indexOf('date');if(ix.some(v=>v<0))throw Error('CSV header must contain time,open,high,low,close (or timestamp instead of time).');
 const rows=[];for(const line of lines.slice(1)){const a=split(line);if(!line.trim())continue;const nums=ix.slice(1).map(k=>Number(a[k]));let t=Number(a[ix[0]]);if(!Number.isFinite(t)||!a[ix[0]].trim())t=Date.parse(a[ix[0]]);else if(t<1e11)t*=1000;if(!Number.isFinite(t)||nums.some(v=>!Number.isFinite(v))||nums.some(v=>v<=0))throw Error('Invalid OHLC/time in CSV row '+(rows.length+2));const [o,h,l,c]=nums;if(h<Math.max(o,c,l)||l>Math.min(o,c,h))throw Error('Invalid high/low in row '+(rows.length+2));rows.push([t,o,h,l,c]);}
 if(rows.length<70)throw Error('At least 70 completed candles required.');for(let i=1;i<rows.length;i++)if(rows[i][0]<=rows[i-1][0])throw Error('Candle timestamps must be strictly increasing, oldest first.');
 const tf=rows.length>1?rows[rows.length-1][0]-rows[rows.length-2][0]:60000;if(tf<1000||tf>86400000)throw Error('Unexpected candle interval. Check timestamps.');
 const now=Date.now();if(rows.some(r=>r[0]>now+60000))throw Error('Future timestamps detected. Check timezone.');
 const completed=rows.filter(r=>r[0]+tf<=now);if(completed.length<70)throw Error('Not enough completed candles after excluding the running candle.');return {rows:completed,excluded:rows.length-completed.length,tf};
}
function renderBinomoIndicators(result,meta){
 const root=el('agreement');if(!root)return;root.textContent='';let up=0,down=0,wait=0;
 for(const name of names){const value=result[name];if(value===1)up++;else if(value===-1)down++;else wait++;
  const card=document.createElement('div');card.className='indicator-chart-group';const head=document.createElement('div');head.className='indicator-chart-heading';const title=document.createElement('strong');title.textContent=name;const state=document.createElement('span');state.textContent=value===1?'UP':value===-1?'DOWN':'WAIT';state.style.color=value===1?colors[0]:value===-1?colors[1]:colors[2];head.append(title,state);card.append(head);
  const plot=document.createElement('div');plot.className='indicator-plot';[1,-1,0].forEach((v,i)=>{const col=document.createElement('div');col.className='indicator-column';const num=document.createElement('b');num.textContent=value===v?'1':'0';const bar=document.createElement('div');bar.className='indicator-column-bar';bar.style.height=(value===v?'100':'0')+'%';bar.style.background=colors[i];const cap=document.createElement('span');cap.textContent=['UP','DOWN','WAIT'][i];col.append(num,bar,cap);plot.append(col);});card.append(plot);root.append(card);
 }
 for(const [id,v] of [['indUp',up],['indDown',down],['indWait',wait]])if(el(id))el(id).textContent=v+'/18';
 const info=el('binomoCsvStatus');if(info)info.textContent=`Binomo OHLC CSV analyzed: ${meta.rows.length} completed candles · ${meta.excluded} running/future candle(s) excluded · ${Math.round(meta.tf/60000)}m interval · 18 classifications: ${up} UP, ${down} DOWN, ${wait} WAIT. ATR is volatility-only; Fractals and Fractal Chaos Bands share pivot logic. These are approximate implementations, not guaranteed Binomo platform indicator values.`;
}
el('calculateBinomo')?.addEventListener('click',async()=>{const file=el('binomoCsv')?.files?.[0],info=el('binomoCsvStatus');if(!file){if(info)info.textContent='Select a Binomo OHLC CSV file first.';return;}try{if(file.size>5e6)throw Error('CSV too large (max 5 MB).');const data=parseBinomoCsv(await file.text());const result=classify(data.rows).result;renderBinomoIndicators(result,data);}catch(e){if(info)info.textContent='CSV not analyzed: '+e.message;}});
function renderCoinStatus(groups){const board=el('coinStatusBoard');if(!board)return;board.textContent='';for(const coin of coins){const g=groups.find(x=>x.coin===coin);const votes=g?[g.result['EMA'],g.result['MACD'],g.result['RSI']]:[];const score=votes.reduce((a,b)=>a+b,0);const state=!g?'WAIT':score>0?'UP':score<0?'DOWN':'WAIT';const chip=document.createElement('div');chip.className='coin-chip '+state.toLowerCase();const name=document.createElement('div');name.textContent=coin;const label=document.createElement('small');label.textContent=g?state:'NO DATA';chip.append(name,label);board.append(chip);}}
let chartMode='candles',lastGraphGroups=[];
const palette=['#2dd4bf','#60a5fa','#f472b6','#fbbf24','#c084fc','#fb7185','#34d399','#a78bfa','#f97316','#94a3b8'];
function lineGraph(groups){
 lastGraphGroups=groups;
 const canvas=el('tenGraph');if(!canvas)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1525';ctx.fillRect(0,0,w,h);
 const legend=el('tenLegend');
 if(!groups.length){ctx.fillStyle='#a8bdd1';ctx.font='20px sans-serif';ctx.fillText('Waiting for Binance market data',70,h/2);if(legend)legend.textContent='No live data';return;}
 const length=Math.min(45,...groups.map(g=>g.rows.length));
 const series=groups.map(g=>{const a=g.rows.slice(-length);const base=a[0][4];return a.map(r=>({t:r[0],o:(r[1]/base-1)*100,h:(r[2]/base-1)*100,l:(r[3]/base-1)*100,c:(r[4]/base-1)*100}));});
 const avg=Array.from({length},(_,i)=>{const a=series.map(s=>s[i]);return {t:a[0].t,o:mean(a.map(r=>r.o)),h:mean(a.map(r=>r.h)),l:mean(a.map(r=>r.l)),c:mean(a.map(r=>r.c))};});
 const values=chartMode==='candles'?avg.flatMap(r=>[r.h,r.l]):series.flatMap(s=>s.map(r=>r.c));
 let min=Math.min(...values),max=Math.max(...values);const pad=Math.max(.08,(max-min)*.13);min-=pad;max+=pad;
 const L=65,R=20,T=22,B=43,W=w-L-R,H=h-T-B;
 const y=v=>T+(max-v)/(max-min)*H,x=i=>L+(i+.5)*W/length;
 ctx.font='13px system-ui,sans-serif';ctx.textAlign='right';
 for(let i=0;i<=5;i++){const v=max-(max-min)*i/5,yy=y(v);ctx.strokeStyle='#253a52';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();ctx.fillStyle='#9bb1c7';ctx.fillText(v.toFixed(2)+'%',L-8,yy+4);}
 if(min<0&&max>0){ctx.strokeStyle='#69849e';ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(L,y(0));ctx.lineTo(w-R,y(0));ctx.stroke();ctx.setLineDash([]);}
 if(chartMode==='candles'){
  const cw=Math.max(4,Math.min(14,W/length*.58));
  avg.forEach((r,i)=>{const up=r.c>=r.o;ctx.strokeStyle=ctx.fillStyle=up?'#14cba0':'#fb6178';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x(i),y(r.h));ctx.lineTo(x(i),y(r.l));ctx.stroke();ctx.fillRect(x(i)-cw/2,Math.min(y(r.o),y(r.c)),cw,Math.max(2,Math.abs(y(r.o)-y(r.c))));});
  if(legend)legend.innerHTML='<span>🟢 Rising average candle</span><span>🔴 Falling average candle</span><span>10-coin normalized average · not a tradable asset</span>';
 }else{
  series.forEach((arr,j)=>{ctx.beginPath();ctx.strokeStyle=palette[coins.indexOf(groups[j].coin)%10];ctx.lineWidth=2.4;arr.forEach((r,i)=>i?ctx.lineTo(x(i),y(r.c)):ctx.moveTo(x(i),y(r.c)));ctx.stroke();});
  if(legend){legend.textContent='';groups.forEach(g=>{const s=document.createElement('span');s.style.borderLeft='4px solid '+palette[coins.indexOf(g.coin)%10];s.textContent=g.coin;legend.appendChild(s);});}
 }
 ctx.fillStyle='#a9bdd1';ctx.textAlign='center';ctx.font='13px system-ui,sans-serif';
 const marks=[0,Math.floor((length-1)/2),length-1];
 marks.forEach(i=>ctx.fillText(new Date(avg[i].t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),x(i),h-14));
}
for(const [id,mode] of [['viewCandles','candles'],['viewLines','lines']]){
 el(id)?.addEventListener('click',()=>{chartMode=mode;for(const [button,m] of [['viewCandles','candles'],['viewLines','lines']])el(button)?.classList.toggle('active',m===mode);if(el('chartViewLabel'))el('chartViewLabel').textContent=mode==='candles'?'10-coin average · completed candles':'10 separate normalized coin lines';lineGraph(lastGraphGroups);});
}
let running=false;
async function update(){if(running)return;running=true;const tf=el('tf')?.value||'1m',status=el('status');if(status)status.textContent='Loading live data…';const good=[],errors=[];await Promise.all(coins.map(async coin=>{try{const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);let response;try{response=await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${coin}USDT&interval=${tf}&limit=125`,{signal:ctrl.signal,cache:'no-store'});}finally{clearTimeout(timer)}if(!response.ok)throw Error('HTTP '+response.status);const raw=await response.json();const now=Date.now();const rows=raw.filter(x=>Number(x[6])<now).map(x=>[+x[0],+x[1],+x[2],+x[3],+x[4]]);const v=classify(rows);good.push({...v,coin});}catch(e){errors.push(coin+': '+e.message)}}));good.sort((a,b)=>coins.indexOf(a.coin)-coins.indexOf(b.coin));renderCoinStatus(good);const votes=good.map(g=>g.result['EMA']+g.result['MACD']+g.result['RSI']);const u=votes.filter(v=>v>0).length,d=votes.filter(v=>v<0).length,z=votes.filter(v=>v===0).length;[['up',u],['down',d],['neutral',z]].forEach(([id,v])=>{if(el(id))el(id).textContent=good.length?v:'—'});if(el('bias'))el('bias').textContent=!good.length?'NO DATA':u>d?'UP':d>u?'DOWN':'MIXED';if(el('explain'))el('explain').textContent=`${good.length}/10 coins loaded. EMA + MACD + RSI descriptive vote, not future-price prediction.`;if(el('tenGraphInfo'))el('tenGraphInfo').textContent=`Updated ${new Date().toLocaleTimeString()} · ${good.length}/10 coins · Completed candles only.`;if(el('log'))el('log').textContent=errors.length?errors.join('\n'):'All 10 coin feeds loaded.';if(status)status.textContent=good.length?`Live: ${good.length}/10`:'Data unavailable';running=false;}
el('refresh')?.addEventListener('click',update);el('tf')?.addEventListener('change',update);let timer=null;function schedule(){if(timer)clearInterval(timer);const ms=Number(el('interval')?.value||30000);if(ms>0)timer=setInterval(update,ms);}el('interval')?.addEventListener('change',schedule);schedule();update();
})();
