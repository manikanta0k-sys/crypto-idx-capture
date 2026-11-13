/* Optional independent two-screenshot timeframe research tool. Does not modify V5.2. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const set=(id,val)=>{const node=$(id);if(node)node.textContent=val;};
const stat={a:null,b:null};
const colors={UP:'#17d9a6',DOWN:'#ff6b83',WAIT:'#d9e1ee'};
function extract(img){
 const cvs=document.createElement('canvas');const s=Math.min(1,1100/img.naturalWidth);
 cvs.width=Math.round(img.naturalWidth*s);cvs.height=Math.round(img.naturalHeight*s);
 const ctx=cvs.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,cvs.width,cvs.height);
 const w=cvs.width,h=cvs.height,pix=ctx.getImageData(0,0,w,h).data;
 const left=Math.round(w*.025),right=Math.round(w*.945),top=Math.round(h*.075),bottom=Math.round(h*.66),runs=[];
 let run=[]; const flush=()=>{if(run.length){runs.push(run);run=[];}};
 for(let x=left;x<right;x++){
  let green=[],red=[];
  for(let y=top;y<bottom;y++){
   const k=(y*w+x)*4,r=pix[k],g=pix[k+1],b=pix[k+2];
   if(g>75&&g>r*1.28&&g>b*1.12&&r<165)green.push(y);
   else if(r>110&&r>g*1.35&&r>b*1.15&&g<170)red.push(y);
  }
  const vals=green.length>=red.length?green:red,sign=green.length>=red.length?1:-1;
  if(vals.length>=2){if(run.length&&run[run.length-1].sign!==sign)flush();run.push({x,sign,count:vals.length,ys:vals});}else flush();
 }flush();
 const widths=runs.map(v=>v.length).filter(v=>v>=2&&v<=18).sort((a,b)=>a-b);
 if(widths.length<8)throw Error('Not enough recognizable candle groups; use a clearer chart screenshot.');
 const median=widths[Math.floor(widths.length/2)];let rejected=0,candles=[];
 for(const r of runs){
  if(r.length<2||r.length>Math.max(17,median*2.3)){rejected++;continue;}
  const all=r.flatMap(v=>v.ys),hi=Math.min(...all),lo=Math.max(...all);
  const centers=r.filter(v=>v.count>=Math.max(3,Math.round(r.length*.65)));
  const c=(centers.length?centers:r).reduce((a,b)=>a.count>b.count?a:b);
  const y0=Math.min(...c.ys),y1=Math.max(...c.ys),up=r[0].sign===1;
  if(lo-hi<2){rejected++;continue;}
  // Pixel-derived relative OHLC, not broker price coordinates.
  candles.push({x:r.reduce((a,v)=>a+v.x,0)/r.length,open:1000-(up?y1:y0),close:1000-(up?y0:y1),high:1000-hi,low:1000-lo});
 }
 candles.sort((a,b)=>a.x-b.x);
 if(candles.length)candles.pop(); // ALWAYS exclude right-most potentially running candle
 if(candles.length<20)throw Error('Only '+candles.length+' usable closed candles; need at least 20 per screenshot.');
 if(rejected>runs.length*.65)throw Error('Most colored groups were ambiguous; try a cleaner image.');
 return {candles,detected:candles.length,rejected};
}
function analyze(ex,tf){
 const c=ex.candles,n=c.length,last=c[n-1].close,old5=c[n-6].close,old10=c[n-11].close;
 const ranges=c.slice(-15).map(v=>v.high-v.low).filter(Number.isFinite);const avgRange=ranges.reduce((a,b)=>a+b,0)/ranges.length;
 const threshold=Math.max(0.3,avgRange*0.4);
 const m5=last-old5,m10=last-old10;
 const ema=(arr,p)=>{let value=arr[0];for(const a of arr.slice(1))value+=2/(p+1)*(a-value);return value;};
 const closes=c.map(v=>v.close),eFast=ema(closes,5),eSlow=ema(closes,12);
 const pts=[m5>threshold?1:m5< -threshold?-1:0,m10>threshold?1:m10< -threshold?-1:0,eFast-eSlow>threshold*.4?1:eFast-eSlow< -threshold*.4?-1:0];
 const score=pts.reduce((a,b)=>a+b,0);
 // Strict decision gating: opposite momentum in a screenshot -> WAIT.
 const dir=pts.includes(1)&&pts.includes(-1)?'WAIT':score>=2?'UP':score<=-2?'DOWN':'WAIT';
 return {tf,dir,pts,score,count:n,avgRange};
}
async function load(slot){
 stat[slot]=null;update();const input=$(slot==='a'?'dualImgA':'dualImgB'),file=input?.files?.[0],preview=$(slot==='a'?'dualPreviewA':'dualPreviewB');
 if(!file){set('dualStatus'+slot.toUpperCase(),'Select a screenshot.');return;}
 if(!file.type.startsWith('image/')||file.size>12e6){set('dualStatus'+slot.toUpperCase(),'Use PNG/JPG/WEBP under 12 MB.');return;}
 const url=URL.createObjectURL(file);
 try{
   const img=new Image(); await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error('Image could not be decoded.'));img.src=url;});
   if(preview){preview.src=url;preview.hidden=false;}
   const tf=Number($(slot==='a'?'dualTfA':'dualTfB').value);
   stat[slot]=analyze(extract(img),tf);
   set('dualStatus'+slot.toUpperCase(),`${stat[slot].count} closed candles · ${tf}m · ${stat[slot].dir} (estimated)`);
 }catch(e){set('dualStatus'+slot.toUpperCase(),'NO DATA · '+e.message);if(preview){preview.hidden=true;preview.removeAttribute('src');}}
 finally {URL.revokeObjectURL(url);update();}
}
function update(){
 const a=stat.a,b=stat.b,target=Number($('dualExpiry')?.value||2),word=$('dualDecision');
 const match=a&&b&&a.dir!=='WAIT'&&a.dir===b.dir;
 // Longer horizon than screenshots' shortest sample gets conservatively WAIT.
 const adequate= a&&b&&Math.max(a.tf,b.tf)>=target;
 const verdict=match&&adequate?a.dir:'WAIT';
 if(word){word.textContent=verdict;word.style.color=colors[verdict];}
 const reason=!a||!b?'Upload both screenshots to calculate a comparison.'
 :a.tf===b.tf?'Both screenshots have the same timeframe. Choose different timeframes for multi-timeframe confirmation.'
 :!adequate?`The longest screenshot timeframe is shorter than ${target}m; insufficient cross-timeframe coverage → WAIT.`
 :!match?'Timeframe direction conflict or weak pattern → WAIT.':`Both ${a.tf}m and ${b.tf}m chart estimates show ${verdict}. Directional bias only, not a verified prediction.`;
 set('dualReason',a&&b&&a.tf===b.tf?'WAIT — '+reason:reason);
 if(a&&b&&a.tf===b.tf){word.textContent='WAIT';word.style.color=colors.WAIT;}
 const origin=$('dualCaptureAt')?.value, end=$('dualTargetAt');
 if(origin&&end){const t=new Date(origin);if(Number.isFinite(t.getTime())){t.setMinutes(t.getMinutes()+target);end.textContent=t.toLocaleString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'});}}
 else if(end)end.textContent='Set screenshot capture time';
 set('dualMeta',a&&b?`Screenshot A: ${a.tf}m ${a.dir} · Screenshot B: ${b.tf}m ${b.dir} · ${target}m horizon`:'Waiting for two screenshots');
}
const start=()=>{
 ['a','b'].forEach(slot=>{
  $(slot==='a'?'dualImgA':'dualImgB')?.addEventListener('change',()=>load(slot));
  $(slot==='a'?'dualTfA':'dualTfB')?.addEventListener('change',()=>load(slot));
 });
 ['dualExpiry','dualCaptureAt'].forEach(id=>$(id)?.addEventListener('change',update));
 $('dualAnalyze')?.addEventListener('click',()=>{if($('dualImgA')?.files?.[0])load('a');if($('dualImgB')?.files?.[0])load('b');});
 update();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
