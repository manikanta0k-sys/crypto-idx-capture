(()=>{'use strict';
const $=id=>document.getElementById(id), circ=2*Math.PI*49;
function arc(id,p,color){const e=$(id);if(!e)return;e.style.stroke=color;e.style.strokeDasharray=circ.toFixed(2);e.style.strokeDashoffset=(circ*(1-Math.max(0,Math.min(100,p))/100)).toFixed(2);}
function update(){
 const sig=($('monitorSignal')?.textContent||'WAIT').trim().toUpperCase();
 const raw=Number($('rsiValue')?.textContent),validRSI=($('rsiValue')?.textContent||'').trim()!=='—'&&Number.isFinite(raw)&&raw>=0&&raw<=100;
 const g=Number($('greenCandles')?.textContent)||0,r=Number($('redCandles')?.textContent)||0,total=g+r;
 const age=Number.parseInt($('monitorAge')?.textContent,10),tf=Number($('chartTimeframe')?.value)||60;
 const fresh=Number.isFinite(age)&&age>=0&&age<=tf&&$('monitorHealth')?.classList.contains('fresh');
 const dir=fresh&&['UP','DOWN'].includes(sig)?sig:'WAIT';
 $('directionLabel').textContent=dir;$('directionLabel').style.color=dir==='UP'?'#00f0a3':dir==='DOWN'?'#ff5470':'#ffbf52';
 arc('directionArc',dir==='WAIT'?0:100,dir==='UP'?'#00f0a3':dir==='DOWN'?'#ff5470':'#ffbf52');
 $('directionNote').textContent=dir==='WAIT'?'No fresh directional agreement':'Screenshot-derived '+dir+' bias (not a forecast)';
 $('rsiLabel').textContent=validRSI?raw.toFixed(1):'—';arc('rsiArc',validRSI?raw:0,validRSI?(raw>=70?'#ff5470':raw<=30?'#00f0a3':'#a76cff'):'#56647a');
 $('rsiNote').textContent=validRSI?(raw>=70?'High RSI reading':raw<=30?'Low RSI reading':'Middle RSI range'):'No RSI value yet';
 const percent=total?g/total*100:0;$('candleLabel').textContent=total?Math.round(percent)+'%':'—';arc('candleArc',percent,'#00e99a');
 $('candleNote').textContent=total?g+' green / '+r+' red reviewed candles':'No reviewed candles';
 $('visualGreen').textContent=g;$('visualRed').textContent=r;
 $('visualTime').textContent=$('monitorLast')?.textContent||'—';
 $('visualStatus').textContent=fresh?'RECENT SCREENSHOT':'AWAITING FRESH ANALYSIS';
}
setInterval(update,1000);document.addEventListener('DOMContentLoaded',update);update();
})();