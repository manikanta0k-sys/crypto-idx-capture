(()=>{'use strict';
const $=id=>document.getElementById(id);let latest=null;
const formatTime=t=>new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const pct=x=>Math.round(Math.max(0,Math.min(100,x)));
function show(i,time,dir,up,reason){$('predTime'+i).textContent=(i===1?'First':'Second')+' upcoming candle · '+(time?formatTime(time):'—');$('predDirection'+i).textContent=dir;$('predCard'+i).className='prediction-card '+dir.toLowerCase();$('predReason'+i).textContent=reason;const block=$('predPercent'+i);block.hidden=dir==='WAIT';if(dir!=='WAIT'){$('predUp'+i).textContent=pct(up)+'%';$('predDown'+i).textContent=(100-pct(up))+'%';$('predUpBar'+i).style.width=pct(up)+'%';$('predDownBar'+i).style.width=(100-pct(up))+'%';}}
function reset(){latest=null;show(1,null,'WAIT',0,'Upload and review candles, then analyze.');show(2,null,'WAIT',0,'Upload and review candles, then analyze.');$('predMeta').textContent='No current estimate.';}
function ema(values,period){let prev=values[0],k=2/(period+1);return values.map(v=>(prev=v*k+prev*(1-k)));}
function rsi(v,p=14){let gain=0,loss=0;for(let i=1;i<=p;i++){let d=v[i]-v[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}gain/=p;loss/=p;for(let i=p+1;i<v.length;i++){let d=v[i]-v[i-1];gain=(gain*(p-1)+Math.max(d,0))/p;loss=(loss*(p-1)+Math.max(-d,0))/p}return loss===0?(gain===0?50:100):100-100/(1+gain/loss)}
function fractal(cs){let last=0;for(let i=2;i<cs.length-2;i++){if([-2,-1,1,2].every(d=>cs[i].low<cs[i+d].low))last=1;if([-2,-1,1,2].every(d=>cs[i].high>cs[i+d].high))last=-1;}return last}
function analyze(){
 const raw=window.chartSignalGetCandles?.()||[];const val=$('captureTime').value;
 if(!val){show(1,null,'WAIT',0,'Enter the actual screenshot capture time.');show(2,null,'WAIT',0,'Time cannot be assigned without capture time.');$('predMeta').textContent='Capture time missing. Upload time is not a substitute for screenshot time.';return;}
 const captured=new Date(val).getTime();if(!Number.isFinite(captured)){reset();$('predMeta').textContent='Invalid capture time.';return;}
 const first=(Math.floor(captured/60000)+1)*60000,second=first+60000,age=(Date.now()-captured)/1000;
 if(raw.length<35){show(1,first,'WAIT',0,'Need at least 35 reviewed candles.');show(2,second,'WAIT',0,'Need at least 35 reviewed candles.');$('predMeta').textContent='Insufficient history. No percentages shown for WAIT.';return;}
 const cs=raw.map(c=>({open:+c.open,high:+c.high,low:+c.low,close:+c.close}));if(cs.some(c=>!Object.values(c).every(Number.isFinite)||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||c.low>c.high)){reset();$('predMeta').textContent='Invalid OHLC data; correct candle rows.';return;}
 // Screenshot pixels are not verified OHLC; scores below are deliberately NOT calibrated probabilities.
 const close=cs.map(c=>c.close),r=rsi(close),fast=ema(close,12),slow=ema(close,26),macd=fast.map((x,i)=>x-slow[i]),signal=ema(macd,9),hist=macd.at(-1)-signal.at(-1),span=Math.max(1e-9,cs.at(-1).high-cs.at(-1).low),body=(cs.at(-1).close-cs.at(-1).open)/span;
 const last=cs.at(-1),prev=cs.at(-2),delta=last.close-prev.close,unit=Math.max(1e-9,Math.abs(last.high-last.low));
 let score=0;score+=Math.max(-1,Math.min(1,(r-50)/25))*0.9;score+=Math.sign(hist)*0.8;score+=Math.sign(macd.at(-1))*0.5;score+=Math.max(-1,Math.min(1,body))*0.6;score+=Math.max(-1,Math.min(1,delta/unit))*0.4;score+=fractal(cs)*0.3;
 // Bounded 50 +/- 18 points, purely an uncalibrated score, not a statistical probability.
 const up1=pct(50+18*Math.tanh(score/2.2)),up2=pct(50+9*Math.tanh(score/2.2));
 const uncertain=Math.abs(score)<0.85;const expired=age>60||age< -10;
 const reason=expired?'Screenshot is older than one candle or timestamp is in the future; estimate suppressed.':uncertain?'Indicators disagree or directional evidence is weak.':'Indicator-weighted directional estimate only; NOT a measured probability.';
 const dir1=expired||uncertain?'WAIT':score>0?'UP':'DOWN';
 // Second candle from the same screenshot is inherently more uncertain; only display direction for strong consensus.
 const dir2=expired||Math.abs(score)<2.2?'WAIT':score>0?'UP':'DOWN';
 show(1,first,dir1,up1,reason);show(2,second,dir2,up2,dir2==='WAIT'&&!expired?'Second minute is not sufficiently supported by the same static screenshot.':reason);
 latest={capture:val,first:new Date(first).toISOString(),firstDirection:dir1,firstUp:dir1==='WAIT'?'':up1,firstDown:dir1==='WAIT'?'':100-up1,second:new Date(second).toISOString(),secondDirection:dir2,secondUp:dir2==='WAIT'?'':up2,secondDown:dir2==='WAIT'?'':100-up2,indicatorScore:score.toFixed(3)};
 $('predMeta').textContent='Screenshot: '+formatTime(captured)+' · Age at analysis: '+Math.round(age)+'s · '+cs.length+' approximate candles · Percentages are uncalibrated directional scores, NOT probabilities. This is not a Binomo live feed.';
}
window.chartSignalV8Reset=reset;window.chartSignalV8Analyze=analyze;
$('captureTime').addEventListener('change',reset);$('imageInput').addEventListener('change',reset);
$('v8Export').addEventListener('click',()=>{if(!latest){$('predMeta').textContent='Run an analysis first.';return}const keys=Object.keys(latest);const csv=[keys.join(','),keys.map(k=>JSON.stringify(String(latest[k]))).join(',')].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='binomo-v8-two-minute-estimate.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
reset();
})();
