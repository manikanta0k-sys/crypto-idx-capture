/* V5.2 combined 22-indicator VIEW ONLY. Does not modify original 18 formulas, Smart Candle Assistant or 4 advanced rules. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const ORIGINAL=['EMA','MACD','RSI','Supertrend','ADX + DI','Bollinger Bands','Stochastic RSI','Parabolic SAR','CCI','Williams %R','Momentum','Awesome Oscillator','Fractals','Moving Average','Fractal Chaos Bands','Alligator','ATR','Stochastic'];
const COLORS={UP:'#17d6a1',DOWN:'#ff637c',WAIT:'#aebdd0',CONTEXT:'#74b5ec','NO DATA':'#526881'};
const TEXT={UP:'UP',DOWN:'DOWN',WAIT:'WAIT',CONTEXT:'CONTEXT','NO DATA':'NO DATA'};
function statusFromTitle(head){
 const v=(head||'').trim().toUpperCase();
 if(v==='UP')return 'UP';if(v==='DOWN')return 'DOWN';if(v==='WAIT')return 'WAIT';
 return 'NO DATA';
}
function originals(){
 const map=new Map();
 for(const c of $('agreement')?.querySelectorAll('.indicator-chart-group')||[]){
  const name=c.querySelector('.indicator-chart-heading strong')?.textContent?.trim();
  const state=c.querySelector('.indicator-chart-heading span')?.textContent;
  if(name&&ORIGINAL.includes(name))map.set(name,statusFromTitle(state));
 }
 return ORIGINAL.map(name=>({name,status:name==='ATR'&&map.get(name)==='WAIT'?'CONTEXT':map.get(name)||'NO DATA',group:'Existing 18',info:name==='ATR'?'Volatility only':''}));
}
function extra(name,nodeId){
 const raw=($(nodeId)?.textContent||'').trim().toUpperCase();
 let status='NO DATA',info='';
 if(raw==='NO DATA'||raw==='INSUFFICIENT DATA'||!raw)return {name,status,group:'New 4',info:raw==='INSUFFICIENT DATA'?'Insufficient candles':''};
 if(name==='Aroon'){status=raw==='UP TREND'?'UP':raw==='DOWN TREND'?'DOWN':'WAIT';info='Trend direction';}
 else if(name==='Donchian'){status=raw==='BREAKOUT UP'?'UP':raw==='BREAKOUT DOWN'?'DOWN':'WAIT';info='Breakout / range';}
 else if(name==='Choppiness'){status='CONTEXT';info=raw==='CHOPPY'?'Choppy market':raw==='TRENDING'?'Trending market':'Mixed trend regime';}
 else if(name==='Keltner'){status=raw==='ABOVE BAND'?'UP':raw==='BELOW BAND'?'DOWN':'WAIT';info='Channel position';}
 return {name,status,group:'New 4',info};
}
function render(source,rows){
 const items=[...originals(),extra('Aroon','advAroon'),extra('Donchian','advDonchian'),extra('Choppiness','advChop'),extra('Keltner','advKeltner')];
 const counts={UP:0,DOWN:0,WAIT:0,CONTEXT:0,'NO DATA':0};
 items.forEach(item=>counts[item.status]++);
 const container=$('combined22Grid');if(!container)return;
 container.replaceChildren();
 for(const item of items){
  const cell=document.createElement('div');cell.className='combined22-item';
  const top=document.createElement('div');top.className='combined22-top';
  const title=document.createElement('div');title.className='combined22-name';title.textContent=item.name;
  const badge=document.createElement('b');badge.className='combined22-state';badge.textContent=TEXT[item.status];badge.style.color=COLORS[item.status];
  const strip=document.createElement('div');strip.className='combined22-strip';
  const fill=document.createElement('b');fill.style.background=COLORS[item.status];strip.append(fill);
  const info=document.createElement('div');info.className='combined22-tag';info.textContent=item.info||item.group;
  top.append(title,badge);cell.append(top,strip,info);container.append(cell);
 }
 $('combined22Counts').replaceChildren();
 for(const [status,label] of [['UP','🟢 UP'],['DOWN','🔴 DOWN'],['WAIT','⚪ WAIT'],['CONTEXT','🔵 CONTEXT'],['NO DATA','— NO DATA']]){
  const span=document.createElement('span');span.textContent=`${label} ${counts[status]}`;$('combined22Counts').append(span);
 }
 const meter=$('combined22Meter');meter.replaceChildren();
 for(const status of ['UP','DOWN','WAIT','CONTEXT','NO DATA']){
  if(!counts[status])continue;const s=document.createElement('span');s.style.width=(counts[status]/22*100)+'%';s.style.background=COLORS[status];meter.append(s);
 }
 meter.setAttribute('aria-label',`22 indicators: ${counts.UP} up, ${counts.DOWN} down, ${counts.WAIT} wait, ${counts.CONTEXT} non-directional context, ${counts['NO DATA']} unavailable.`);
 $('combined22DataChip').textContent=source==='screenshot'?'PIXEL ESTIMATE':source==='csv'?'OHLC CSV':'NO DATA';
 const note=$('combined22Note');
 if(source==='none')note.textContent='NO DATA: Upload a usable screenshot or authorized OHLC CSV. Not enough data must not be counted as WAIT.';
 else note.textContent=`${rows} completed ${source==='screenshot'?'pixel-estimated':'imported'} candles. 18 original indicators + 4 chart tools. ATR and Choppiness are context, not directional votes. NOT a win probability or reliable next-candle forecast. No live Binomo feed.`;
}
window.addEventListener('fusion:binomo-candles',e=>{
 const d=e.detail||{};render(Array.isArray(d.rows)&&d.rows.length>=20?(d.source||'screenshot'):'none',Array.isArray(d.rows)?d.rows.length:0);
});
render('none',0);
})();