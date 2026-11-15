/* Next Candle Monitor V3 add-on: crop preview, image provenance, distinct screenshot comparison,
   and descriptive false-signal safeguards. Existing Smart Candle Assistant V5.2 is untouched.
   All screenshot OHLC is pixel-relative and cannot verify exchange timestamps or prices. */
(()=>{'use strict';
const $=id=>document.getElementById(id),M=60000;
const put=(id,text)=>{const e=$(id);if(e)e.textContent=String(text);};
const format=t=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(new Date(t));
const minute=t=>Math.floor(t/M);
const mid=arr=>{const x=arr.filter(Number.isFinite).sort((a,b)=>a-b);return x.length?x[Math.floor(x.length/2)]:NaN;};
let shots=[],originalSrc='',cropSrc='',originalImage=null,originalAt=0,activeToken='',currentMode='none',lastSignalTarget=0,currentError='';
let pendingNewImage=false,lastLoadedSrc='';
try{const saved=JSON.parse(localStorage.getItem('crypto10-nextcandle-v1-journal')||'[]');
 if(Array.isArray(saved)){const last=saved.filter(x=>['UP','DOWN'].includes(x.dir)).sort((a,b)=>(b.created||0)-(a.created||0))[0];
  if(last?.target&&Number.isFinite(+last.target))lastSignalTarget=+last.target;
 }
}catch(_){ }
function fingerprint(img){
 try{const c=document.createElement('canvas');c.width=256;c.height=144;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,256,144);
  const p=g.getImageData(0,0,256,144).data;let hash=2166136261;
  for(let i=0;i<p.length;i+=4){for(let j=0;j<3;j++){hash^=(p[i+j]>>3);hash=Math.imul(hash,16777619);}}
  return (hash>>>0).toString(16);
 }catch(_){return null;}
}
function snapNew(d){
 const img=$('shotPreview'),src=img?.currentSrc||img?.src||'';
 if(!src)return null;
 const isCrop=!!cropSrc&&src===cropSrc;
 if(!isCrop && (!originalSrc || (src!==originalSrc))){
  originalSrc=src;activeToken=src;originalAt=Number.isFinite(+d.at)?+d.at:Date.now();originalImage=null;
  if(cropSrc){try{URL.revokeObjectURL(cropSrc);}catch(_){}}cropSrc='';
  // A new upload is not evidence of the same market or timeframe.
  if($('ncV3SameMarket'))$('ncV3SameMarket').checked=false;
  loadOriginalPreview(src);
 }
 if(!activeToken){activeToken=originalSrc||src;originalAt=+d.at||Date.now();loadOriginalPreview(originalSrc||src);}
 return {src,token:activeToken,isCrop};
}
function inferDirection(rows){
 if(rows.length<30)return 'INSUFFICIENT';
 const n=rows.length,cs=rows.map(r=>r[4]),avg=(a)=>a.reduce((s,x)=>s+x,0)/a.length;
 const a=avg(cs.slice(-9)),b=avg(cs.slice(-21));
 const recent=cs[n-1]-cs[n-5],vol=mid(rows.slice(-20).map(r=>r[2]-r[3]));
 if(!Number.isFinite(vol)||vol<=0)return 'MIXED';
 if(a>b+vol*.10&&recent>0)return 'UP LEAN';
 if(a<b-vol*.10&&recent<0)return 'DOWN LEAN';
 return 'MIXED';
}
function readerQuality(d){
 const count=Array.isArray(d.rows)?d.rows.length:0,rej=+d.rejected||0;
 const label=d.quality||'UNKNOWN';
 const good=count>=50 && label==='FAIR' && rej<=Math.max(10,count*.22);
 return {good,count,rej,label};
}
function onData(event){
 if(pendingNewImage)return; // old image pixels may be present before new image load
 const d=event.detail||{};
 currentMode=d.source==='csv'?'csv':d.source==='screenshot'?'screenshot':'none';
 if(currentMode==='csv'){
  currentError='';put('ncV3Quality','CSV · USER DATA');put('ncV3QualityInfo','Check timestamp and instrument authenticity');
  put('ncV3Pair','N/A · CSV');put('ncV3PairInfo','Use consecutive verified 1m time rows');
  put('ncV3Timeline','CSV loaded');return;
 }
 if(currentMode==='none'||!Array.isArray(d.rows)||d.rows.length<20){
  // Even a failed reader must retain its ORIGINAL input: users need the crop tool to recover.
  const img=$('shotPreview');
  if(img?.complete&&img?.naturalWidth){snapNew({at:d.at||Date.now()});currentMode='screenshot';}
  currentError=d.error||'Candle extraction did not return 20 usable samples';
  put('ncV3Quality','DATA ERROR');put('ncV3QualityInfo',currentError);
  put('ncV3Guard','WAIT · NO DATA');put('ncV3Flags',currentError+' · Use Manual chart crop or authorized OHLC CSV.');return;
 }
 const src=snapNew(d);if(!src)return;
 currentError='';
 const q=readerQuality(d),rows=d.rows.map(r=>r.slice(0,5));
 let previous=shots.find(s=>s.token===src.token);
 if(!previous){
  const hash=fingerprint($('shotPreview'));
  previous={token:src.token,at:originalAt,hash,rows,quality:q,bias:inferDirection(rows),decision:'WAIT',reason:''};
  shots.push(previous);if(shots.length>4)shots=shots.slice(-4);
 }else{previous.rows=rows;previous.quality=q;previous.bias= inferDirection(rows);previous.reason='';if(!src.isCrop)previous.hash=fingerprint($('shotPreview'));}
 put('ncV3Quality',q.good?'PIXEL READ · FAIR':q.count<50?'LOW CANDLE COUNT':'PIXEL READ · LOW');
 put('ncV3QualityInfo',`${q.count} apparent closed groups · ${q.rej} rejected · ${d.preset||'unknown'} crop · unverified prices`);
 updatePaired();
}
function latestPair(){return shots.slice(-2);}
function updatePaired(){
 if(currentMode==='csv')return;
 const pair=latestPair();
 if(!pair.length){put('ncV3Pair','0 / 2 READY');put('ncV3PairInfo','Choose first screenshot');put('ncV3Timeline','Not started');return;}
 if(pair.length===1){
  put('ncV3Pair','1 / 2 READY');put('ncV3PairInfo','Take another separate 1m screenshot in the next minute');
  put('ncV3Timeline',`First received ${format(pair[0].at)}`);return;
 }
 const [first,last]=pair,gap=(last.at-first.at)/1000;
 const duplicates=!!(first.hash&&last.hash&&first.hash===last.hash);
 put('ncV3Pair',duplicates?'DUPLICATE IMAGE':`2 / 2 RECEIVED`);
 put('ncV3PairInfo',`${Math.round(gap)}s apart · ${first.bias} → ${last.bias}${duplicates?' · identical screenshot':''}`);
 put('ncV3Timeline',`${format(first.at)} → ${format(last.at)}`);
}
function riskFlags(rows,result){
 const blocks=[];
 if(!Array.isArray(rows)||rows.length<50)return ['Insufficient bars to evaluate reversal/chop protection'];
 const end=rows.slice(-25),rng=end.map(r=>Math.max(0,r[2]-r[3])),body=end.map(r=>Math.abs(r[4]-r[1]));
 const med=mid(rng.slice(0,20)),last=rng[rng.length-1],latest=body[body.length-1];
 if(!Number.isFinite(med)||med<=0)return ['Missing meaningful candle ranges'];
 if(last>med*3)blocks.push('Volatility spike in last closed candle');
 if(last>0&&latest/last<.11)blocks.push('Indecision / tiny last candle body');
 const colors=end.slice(-12).map(r=>Math.sign(r[4]-r[1])).filter(Boolean);
 const flips=colors.slice(1).filter((v,i)=>v!==colors[i]).length;
 if(colors.length>=10&&flips>=8)blocks.push('Frequent red/green alternation · choppy market');
 const avg=(a)=>a.reduce((s,x)=>s+x,0)/Math.max(a.length,1);
 if(avg(rng.slice(-6))<avg(rng.slice(-22,-6))*.43)blocks.push('Low-range consolidation · possible false breakout');
 const lastC=end[end.length-1],bodyRatio=last/Math.max(.00001,latest);
 if(result?.dir==='UP'&&lastC[4]<lastC[1]&&bodyRatio<1.75)blocks.push('Latest closed candle strongly opposes UP');
 if(result?.dir==='DOWN'&&lastC[4]>lastC[1]&&bodyRatio<1.75)blocks.push('Latest closed candle strongly opposes DOWN');
 return blocks;
}
function guard({dataset,result,now,target}){
 const problems=[];let timing=[];
 if(!dataset)return {problems:['No dataset']};
 if(dataset.source==='screenshot'){
  const p=latestPair(),newest=p[p.length-1];
  if(p.length<2)problems.push('V3: Need a second distinct screenshot from the next minute');
  if(newest && !newest.quality.good)problems.push('V3: Latest screenshot low quality; use crop or authorized OHLC');
  if(p.length===2){
   const [a,b]=p,dt=(b.at-a.at)/1000;
   if(dt<10||dt>150||minute(a.at)===minute(b.at))problems.push('V3: Two screenshots must be 10–150 seconds apart and from different minutes');
   if(a.hash&&b.hash&&a.hash===b.hash)problems.push('V3: Identical image cannot confirm a changed candle');
   if(!a.quality.good)problems.push('V3: First screenshot did not pass minimum pixel quality');
   if(a.bias!==b.bias||!['UP LEAN','DOWN LEAN'].includes(a.bias))problems.push('V3: Two screenshots do not share a clear direction');
   if((result.dir==='UP'&&b.bias!=='UP LEAN')||(result.dir==='DOWN'&&b.bias!=='DOWN LEAN'))problems.push('V3: 5-rule decision conflicts with two-screenshot comparison');
   if(!$('ncV3SameMarket')?.checked)problems.push('V3: Confirm same Binomo IDX instrument and 1m chart in both screenshots');
  }
  put('ncV3Quality',newest?.quality.good?'PIXEL READ · FAIR':'PIXEL READ · LOW');
  updatePaired();
 }else{put('ncV3Pair','N/A · CSV');put('ncV3PairInfo','Consecutive verified timestamps required in V2 engine');}
 const flags=riskFlags(dataset.rows,result);
 if(flags.length)problems.push(...flags.map(v=>'V3: '+v));
 if(lastSignalTarget&&target!==lastSignalTarget&&target>lastSignalTarget&&target-lastSignalTarget<3*M){
  problems.push('V3: 3-minute cooldown since previous research signal');
 }
 put('ncV3Guard',problems.length?'WAIT · CHECKS':'CHECKS PASS');
 put('ncV3GuardInfo',problems.length?`${problems.length} V3 checks pending/blocked`:'No extra flags; chart data still unverified');
 put('ncV3Flags',problems.length?problems.slice(0,5).join(' · ')+(problems.length>5?` · +${problems.length-5} more`:''):
   'V3 add-on checks pass. V2 freshness, 5-rule alignment and timestamp guards must ALSO pass. This is not verified live Binomo data.');
 return {problems};
}
function noteSignal(target){lastSignalTarget=target;}
function originalReceiptAt(){return originalAt||0;}
function getTrim(){
 const left=+$('ncV3Left').value,right=+$('ncV3Right').value,top=+$('ncV3Top').value,bottom=+$('ncV3Bottom').value;
 return {left,right,top,bottom,valid:left+right<=70&&top+bottom<=75};
}
function loadOriginalPreview(src){
 if(!src)return;
 const img=new Image();img.onload=()=>{if(src!==originalSrc)return;originalImage=img;renderCrop();};img.onerror=()=>put('ncV3CropStatus','Original image could not be loaded.');img.src=src;
}
function renderCrop(){
 const cv=$('ncV3CropCanvas'),ctx=cv?.getContext('2d');if(!ctx)return;
 const values=getTrim();for(const n of ['Left','Right','Top','Bottom'])put('ncV3'+n+'Value',values[n.toLowerCase()]+'%');
 const img=originalImage;
 if(!img?.naturalWidth){ctx.fillStyle='#11243a';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#adcbe3';ctx.font='12px system-ui';ctx.fillText('Select a chart screenshot first',16,70);return;}
 cv.width=Math.max(240,Math.min(580,img.naturalWidth));cv.height=Math.round(cv.width*img.naturalHeight/img.naturalWidth);
 ctx.drawImage(img,0,0,cv.width,cv.height);
 const x=cv.width*values.left/100,y=cv.height*values.top/100,w=cv.width*(1-(values.left+values.right)/100),h=cv.height*(1-(values.top+values.bottom)/100);
 ctx.fillStyle='rgba(5,13,25,.58)';ctx.fillRect(0,0,cv.width,y);ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,cv.width-x-w,h);ctx.fillRect(0,y+h,cv.width,cv.height-y-h);
 ctx.strokeStyle=values.valid?'#1ae2a5':'#fa647d';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);
 put('ncV3CropStatus',values.valid?'Green box = area to analyze; excludes controls/indicator panels.':'Crop area too small. Reduce trimmed percentages.');
}
function applyCrop(){
 if(!originalImage?.naturalWidth){put('ncV3CropStatus','Upload screenshot first.');return;}
 const v=getTrim();if(!v.valid){put('ncV3CropStatus','Crop area too small.');return;}
 const img=originalImage,cv=document.createElement('canvas');
 const sx=Math.round(img.naturalWidth*v.left/100),sy=Math.round(img.naturalHeight*v.top/100);
 const sw=Math.round(img.naturalWidth*(100-v.left-v.right)/100),sh=Math.round(img.naturalHeight*(100-v.top-v.bottom)/100);
 if(sw<80||sh<80){put('ncV3CropStatus','Need at least 80×80 pixels of the chart.');return;}
 cv.width=sw;cv.height=sh;cv.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
 put('ncV3CropStatus','Applying crop to the existing screenshot (not counted as second upload)…');
 cv.toBlob(blob=>{
  if(!blob){put('ncV3CropStatus','Canvas crop conversion failed.');return;}
  const old=cropSrc;cropSrc=URL.createObjectURL(blob);
  if($('ncCrop'))$('ncCrop').value='full';
  const preview=$('shotPreview');pendingNewImage=true;preview.src=cropSrc;preview.style.display='block';
  if(old)try{URL.revokeObjectURL(old);}catch(_){ }
  put('ncV3CropStatus','Cropped image analyzed; same source screenshot. Use a NEW screenshot to confirm trend.');
 },'image/png');
}
function resetCrop(){
 if(!originalSrc){put('ncV3CropStatus','No original image to restore.');return;}
 if($('ncCrop'))$('ncCrop').value='auto';
 const preview=$('shotPreview');pendingNewImage=true;preview.src=originalSrc;preview.style.display='block';
 put('ncV3CropStatus','Original image restored and reanalyzing; does not count as new screenshot.');
}
window.CryptoFusionV3={guard,noteSignal,originalReceiptAt,isLoading:()=>pendingNewImage,debug:()=>({shots:shots.map(s=>({at:s.at,bias:s.bias,quality:s.quality,hash:s.hash})),originalAt,source:currentMode,lastSignalTarget})};
window.addEventListener('fusion:binomo-candles',onData);
const shotPreview=$('shotPreview');
// The original V5.2 file-input microtask sometimes parses the OLD displayed bitmap.
// This V3 layer leaves its formulas untouched and rechecks only the actually loaded bitmap.
$('shotFile')?.addEventListener('change',()=>{pendingNewImage=true;});
shotPreview?.addEventListener('load',()=>{
 const src=shotPreview.currentSrc||shotPreview.src;
 if(!src||!shotPreview.complete||!shotPreview.naturalWidth)return;
 if(src!==lastLoadedSrc||pendingNewImage){
  lastLoadedSrc=src;pendingNewImage=false;
  $('estimateBinomo')?.click();
 }
});
const observer=new MutationObserver(()=>{
 const current=shotPreview?.src||'';
 if(current&&current!==lastLoadedSrc)pendingNewImage=true;
});
if(shotPreview)observer.observe(shotPreview,{attributes:true,attributeFilter:['src']});
for(const id of ['ncV3Left','ncV3Right','ncV3Top','ncV3Bottom'])$(id)?.addEventListener('input',renderCrop);
$('ncV3Apply')?.addEventListener('click',applyCrop);
$('ncV3Reset')?.addEventListener('click',resetCrop);
$('ncV3SameMarket')?.addEventListener('change',()=>window.CryptoFusionV2Refresh?.());
renderCrop();
})();
