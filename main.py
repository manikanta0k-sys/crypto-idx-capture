import asyncio, time, math
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

app=FastAPI(title='10 Crypto Market Monitor — NOT Binomo IDX')
app.add_middleware(CORSMiddleware,allow_origins=['https://manikanta0k-sys.github.io'],allow_methods=['GET'],allow_headers=['*'])
SYMBOLS=['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','TRXUSDT','AVAXUSDT','LINKUSDT']
BASE='https://data-api.binance.vision/api/v3/klines'
cache={'at':0,'data':None}
lock=asyncio.Lock()

def sma(x,n):return sum(x[-n:])/n

def rsi(c,n=14):
    if len(c)<n+2:return None
    g=sum(max(c[i]-c[i-1],0) for i in range(1,n+1))/n
    l=sum(max(c[i-1]-c[i],0) for i in range(1,n+1))/n
    for i in range(n+1,len(c)):
        d=c[i]-c[i-1];g=(g*(n-1)+max(d,0))/n;l=(l*(n-1)+max(-d,0))/n
    return 100 if l==0 and g>0 else 50 if l==0 else 100-100/(1+g/l)

def psar(h,l,step=.02,maxaf=.2):
    up=h[1]>=h[0];sar=l[0] if up else h[0];ep=h[0] if up else l[0];af=step
    for i in range(2,len(h)):
        sar=sar+af*(ep-sar)
        if up:
            sar=min(sar,l[i-1],l[i-2])
            if l[i]<sar:up=False;sar=ep;ep=l[i];af=step
            elif h[i]>ep:ep=h[i];af=min(maxaf,af+step)
        else:
            sar=max(sar,h[i-1],h[i-2])
            if h[i]>sar:up=True;sar=ep;ep=h[i];af=step
            elif l[i]<ep:ep=l[i];af=min(maxaf,af+step)
    return sar

def analyze(symbol,rows):
    now=int(time.time()*1000)
    closed=[r for r in rows if int(r[6])<now-1000]
    if len(closed)<55:raise ValueError('Insufficient completed candles')
    o=[float(r[1]) for r in closed];h=[float(r[2]) for r in closed];l=[float(r[3]) for r in closed];c=[float(r[4]) for r in closed]
    buy=sum(float(r[10]) for r in closed[-5:]);total=sum(float(r[7]) for r in closed[-5:]);buy_pct=100*buy/total if total>0 else None
    mid=sma(c,20);sar=psar(h,l)
    # PSAR and BB midline cross / trend confirmation
    ps=1 if c[-1]>sar and c[-1]>mid and c[-2]<=sma(c[:-1],20) else -1 if c[-1]<sar and c[-1]<mid and c[-2]>=sma(c[:-1],20) else 0
    # Heikin Ashi candle body color
    ha_close=[(o[i]+h[i]+l[i]+c[i])/4 for i in range(len(c))]
    ha_open=[(o[0]+c[0])/2]
    for i in range(1,len(c)):ha_open.append((ha_open[-1]+ha_close[i-1])/2)
    ha=1 if ha_close[-1]>ha_open[-1] else -1 if ha_close[-1]<ha_open[-1] else 0
    # Support/resistance range from preceding 20 candles, no signal after sharp movement
    support=min(l[-21:-1]);resistance=max(h[-21:-1]);span=max(resistance-support,1e-12)
    recent_move=abs(c[-1]-c[-2])/max(c[-2],1e-12)
    rng=0 if recent_move>.025 else 1 if c[-1]<support+.15*span and c[-1]>c[-2] else -1 if c[-1]>resistance-.15*span and c[-1]<c[-2] else 0
    # AO(5,34) median price and RSI(14) 50-line cross
    med=[(h[i]+l[i])/2 for i in range(len(c))]
    ao=sma(med,5)-sma(med,34)
    prev_ao=sma(med[:-1],5)-sma(med[:-1],34)
    r=rsi(c);prev_r=rsi(c[:-1])
    ar=1 if prev_r<=50<r and prev_ao<=0<ao else -1 if prev_r>=50>r and prev_ao>=0>ao else 0
    votes=[ps,ha,rng,ar];score=sum(votes)
    signal='UP' if score>=2 else 'DOWN' if score<=-2 else 'WAIT'
    return {'symbol':symbol,'price':c[-1],'change_pct':round(100*(c[-1]/c[-2]-1),3),'buy_pct':round(buy_pct,1) if buy_pct is not None else None,'sell_pct':round(100-buy_pct,1) if buy_pct is not None else None,'signal':signal,'score':score,'rsi':round(r,1),'ao':round(ao,6),'psar':round(sar,6),'bb_mid':round(mid,6),'strategies':{'psar_bb':ps,'heikin_ashi':ha,'support_resistance':rng,'ao_rsi':ar},'last_candle_ms':int(closed[-1][6]),'series':[round(100*(x/c[-31]-1),3) for x in c[-30:]]}

async def fetch_one(client,symbol):
    try:
        res=await client.get(BASE,params={'symbol':symbol,'interval':'1m','limit':90})
        res.raise_for_status();return analyze(symbol,res.json())
    except Exception as e:return {'symbol':symbol,'signal':'WAIT','error':str(e)[:110]}

@app.get('/')
def root():return {'service':'Crypto 10 Monitor','source':'Binance public spot market — NOT Binomo Crypto IDX','endpoint':'/api/market'}

@app.get('/api/market')
async def market():
    async with lock:
        if cache['data'] is not None and time.time()-cache['at']<55:return cache['data']
        async with httpx.AsyncClient(timeout=13,headers={'User-Agent':'Crypto10Monitor/1.0'}) as client:
            coins=await asyncio.gather(*(fetch_one(client,s) for s in SYMBOLS))
        valid=[x for x in coins if 'error' not in x and time.time()*1000-x['last_candle_ms']<180000]
        up=sum(x['signal']=='UP' for x in valid);down=sum(x['signal']=='DOWN' for x in valid)
        # Strict quorum; absence of fresh data always WAIT
        signal='UP' if len(valid)>=8 and up>=6 else 'DOWN' if len(valid)>=8 and down>=6 else 'WAIT'
        momentum=round(sum(x['score'] for x in valid)/max(len(valid)*4,1)*100,1)
        buy_num=sum(x['buy_pct'] for x in valid if x['buy_pct'] is not None)
        buy_den=sum(x['buy_pct'] is not None for x in valid)
        combined=[]
        if valid:
            for i in range(30):combined.append(round(sum(x['series'][i] for x in valid)/len(valid),3))
        result={'source':'Binance public spot market','not_binomo':True,'updated_at':datetime.now(timezone.utc).isoformat(),'signal':signal,'up':up,'down':down,'wait':len(valid)-up-down,'valid':len(valid),'momentum_score':momentum,'buy_pct':round(buy_num/buy_den,1) if buy_den else None,'combined_series':combined,'coins':coins,'note':'Buy/sell is taker buy versus remaining traded quote volume over last five completed 1-minute candles. Not all buyers and sellers, not Binomo order flow. Signals are unvalidated heuristics.'}
        cache.update(at=time.time(),data=result)
        return result
