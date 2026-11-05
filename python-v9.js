(()=>{'use strict';
const $=id=>document.getElementById(id),status=$('pythonStatus'),root=$('pythonResults');
const saved=localStorage.getItem('chart-signal-v9-python-url');if(saved)$('pythonUrl').value=saved;
function base(){const raw=$('pythonUrl').value.trim().replace(/\/+$/,'');if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(raw)&&!/^http:\/\/localhost:\d+$/.test(raw)&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(raw))throw Error('Enter a valid HTTPS backend URL (localhost HTTP is allowed).');localStorage.setItem('chart-signal-v9-python-url',raw);return raw;}
async function request(path,opts){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(base()+path,{...opts,signal:controller.signal});const json=await response.json();if(!response.ok)throw Error(json.detail?JSON.stringify(json.detail):'HTTP '+response.status);return json;}finally{clearTimeout(timeout)}}
$('pythonHealth').onclick=async()=>{status.textContent='Connecting…';try{const x=await request('/health');status.textContent='Connected: '+x.status+' · '+x.source}catch(e){status.textContent='Connection failed: '+e.message+' Check backend deployment and CORS.'}};
$('pythonAnalyze').onclick=async()=>{root.replaceChildren();status.textContent='Analyzing reviewed candles…';try{
 const candles=window.chartSignalGetCandles?.()||[];if(candles.length<35)throw Error('Review at least 35 candles first.');
 const capture=$('captureTime').value;if(!capture)throw Error('Enter the actual screenshot capture time.');
 const ms=new Date(capture).getTime();if(!Number.isFinite(ms))throw Error('Invalid screenshot timestamp.');
 const payload={candles,capture_time:new Date(ms).toISOString(),timeframe_seconds:60};
 const data=await request('/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 for(const p of data.predictions){const card=document.createElement('article');card.className='prediction-card '+p.direction.toLowerCase();const heading=document.createElement('h3');heading.textContent=new Date(p.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})+' — '+p.direction;const detail=document.createElement('p');detail.textContent=p.direction==='WAIT'?'WAIT · '+p.reason:'UP '+p.up_score+'% · DOWN '+p.down_score+'% (uncalibrated scores)';card.append(heading,detail);root.append(card)}
 status.textContent='Python response · '+data.indicators.rsi14+' RSI · '+data.age_seconds+'s screenshot age. Not a verified prediction.';
 }catch(e){status.textContent='Analysis unavailable: '+e.message}}
})();
