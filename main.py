import asyncio, os, time, math
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

app=FastAPI(title='Crypto 10 Spot Market Monitor',version='1.0')
app.add_middleware(CORSMiddleware,allow_origins=['https://manikanta0k-sys.github.io','http://localhost:8000'],allow_methods=['GET'],allow_headers=['*'])
SYMBOLS=['BTC','ETH','BNB','SOL','XRP','ADA','DOGE','TRX','AVAX','LINK']
_cache={'at':0,'value':None}

def sma(xs,n): return sum(xs[-n:])/n if len(xs)>=n else None

def rsi(xs,n=14):
    if len(xs)<n+2:return None
    changes=[xs[i]-xs[i-1] for i in range(1,len(xs))]
    gains=[max(0,x) for x in changes];losses=[max(0,-x) for x in changes]
    avg_g=sum(gains[:n])/n;avg_l=sum(losses[:n])/n
    for i in range(n,len(changes)):
        avg_g=(avg_g*(n-1)+gains[i])/n;avg_l=(avg_l*(n-1)+losses[i])/n
    return 100 if avg_l==0 else 100-100/(1+avg_g/avg_l)

def psar(high,low,step=.02,maximum=.2):
    if len(high)<3:return None
    up=high[1]>=high[0]; sar=low[0] if up else high[0];ep=max(high[:2]) if up else min(low[:2]);af=step
    for i in range(2,len(high)):
        sar=sar+af*(ep-sar)
        if up:
            sar=min(sar,low[i-1],low[i-2])
            if low[i]<sar:up=False;sar=ep;ep=low[i];af=step
            elif high[i]>ep:ep=high[i];af=min(maximum,af+step)
        else:
            sar=max(sar,high[i-1],high[i-2])
            if high[i]>sar:up=True;sar=ep;ep=high[i];af=step
            elif low[i]<ep:ep=low[i];af=min(maximum,af+step)
    return sar

def vote(value):return 'UP' if value>0 else 'DOWN' if value<0 else 'WAIT'

def analyze(rows):
    # Exchange 1-minute candles; discard the latest potentially unfinished candle.
    rows=rows[:-1]
    if len(rows)<45:raise ValueError('Insufficient closed candles')
    o=[float(x[1]) for x in rows];h=[float(x[2]) for x in rows];l=[float(x[3]) for x in rows];c=[float(x[4]) for x in rows]
    volume=sum(float(x[5]) for x in rows[-15:]);buy=sum(float(x[9]) for x in rows[-15:]);sell=max(0,volume-buy)
    # PSAR and BB: middle-band and SAR positioning. This is a heuristic, not a strict crossing-only signal.
    mid=sma(c,20);sar=psar(h,l)
    ps=vote(1 if c[-1]>mid and c[-1]>sar else -1 if c[-1]<mid and c[-1]<sar else 0)
    # Heikin Ashi candle direction and body strength.
    ha_open=(o[0]+c[0])/2;ha_close=(o[0]+h[0]+l[0]+c[0])/4
    for i in range(1,len(c)):
        newclose=(o[i]+h[i]+l[i]+c[i])/4
        ha_open=(ha_open+ha_close)/2;ha_close=newclose
    ha=vote(1 if ha_close>ha_open else -1 if ha_close<ha_open else 0)
    # Range support/resistance proximity heuristic, not a proprietary ribbon formula.
    hi=max(h[-31:-1]);lo=min(l[-31:-1]);span=max(hi-lo,1e-12)
    ribbon=vote(1 if c[-1]>hi or (c[-1]-lo)/span<.18 else -1 if c[-1]<lo or (hi-c[-1])/span<.18 else 0)
    mids=[(a+b)/2 for a,b in zip(h,l)]
    ao=sma(mids,5)-sma(mids,34)
    rr=rsi(c); ar=vote(1 if ao>0 and rr>50 else -1 if ao<0 and rr<50 else 0)
    strategies={'PSAR + Bollinger':ps,'Heikin Ashi':ha,'Range Ribbon (heuristic)':ribbon,'Awesome + RSI':ar}
    up=sum(v=='UP' for v in strategies.values());down=sum(v=='DOWN' for v in strategies.values())
    signal='UP' if up>=3 else 'DOWN' if down>=3 else 'WAIT'
    return {'price':c[-1],'signal':signal,'strategies':strategies,'buy_volume':round(buy,5),'sell_volume':round(sell,5),'buy_pct':round(100*buy/volume,1) if volume else None,'rsi':round(rr,1),'series':[round((v/c[-31]-1)*100,4) for v in c[-31:]],'last_candle_ms':int(rows[-1][0])}

async def fetch(client,symbol):
    urls=['https://data-api.binance.vision/api/v3/klines','https://api.binance.com/api/v3/klines']
    error='Market feed unavailable'
    for url in urls:
        try:
            resp=await client.get(url,params={'symbol':symbol+'USDT','interval':'1m','limit':75})
            resp.raise_for_status();data=resp.json()
            if not isinstance(data,list):raise ValueError('Unexpected exchange response')
            return symbol,analyze(data)
        except Exception as exc:error=type(exc).__name__+': '+str(exc)[:100]
    return symbol,{'signal':'WAIT','error':error}

@app.get('/')
def root():return {'service':'Crypto 10 Spot Market Monitor','status':'running','market_endpoint':'/api/market'}

@app.get('/api/market')
async def market():
    now=time.time()
    if _cache['value'] is not None and now-_cache['at']<50:return _cache['value']
    async with httpx.AsyncClient(timeout=12,headers={'User-Agent':'Crypto10Monitor/1.0'}) as client:
        results=await asyncio.gather(*(fetch(client,s) for s in SYMBOLS))
    coins={s:d for s,d in results};valid=[d for d in coins.values() if 'price' in d]
    combined='WAIT';combined_series=[];buy_pct=None
    if len(valid)>=8:
        up=sum(d['signal']=='UP' for d in valid);down=sum(d['signal']=='DOWN' for d in valid)
        if up>=math.ceil(len(valid)*.7):combined='UP'
        elif down>=math.ceil(len(valid)*.7):combined='DOWN'
        combined_series=[round(sum(d['series'][i] for d in valid)/len(valid),4) for i in range(30)]
        total_buy=sum(d['buy_volume']*d['price'] for d in valid);total_sell=sum(d['sell_volume']*d['price'] for d in valid)
        if total_buy+total_sell:buy_pct=round(100*total_buy/(total_buy+total_sell),1)
    payload={'source':'Public Binance spot USDT markets (NOT Binomo IDX)','timeframe':'1m closed candles','generated_at':int(now),'refresh_seconds':60,'valid_markets':len(valid),'total_markets':len(SYMBOLS),'status':'live' if len(valid)==10 else 'partial' if valid else 'unavailable','coins':coins,'combined_signal':combined,'combined_series':combined_series,'combined_buy_pct':buy_pct,'disclaimer':'Spot market indicator, not a prediction or Binomo signal. WAIT on insufficient consensus/data.'}
    _cache.update(at=now,value=payload)
    return payload
