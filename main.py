import os, csv, io, math, time
from collections import deque
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title='Binomo Crypto IDX — authorized data only')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['GET','POST'], allow_headers=['*'])
CANDLES = deque(maxlen=1500)
HISTORY = deque(maxlen=120)
LAST_KEY = None

def ema(values, period):
    k=2/(period+1); out=[]; v=values[0]
    for x in values:
        v=x*k+v*(1-k); out.append(v)
    return out

def rsi(values, period=14):
    changes=[values[i]-values[i-1] for i in range(1,len(values))]
    gains=[max(x,0) for x in changes]; losses=[max(-x,0) for x in changes]
    ag=sum(gains[:period])/period; al=sum(losses[:period])/period
    for g,l in zip(gains[period:],losses[period:]):
        ag=(ag*(period-1)+g)/period; al=(al*(period-1)+l)/period
    return 100 if al==0 and ag>0 else 50 if al==0 else 100-100/(1+ag/al)

def analysis():
    global LAST_KEY
    data=list(CANDLES)
    base={'source':'Binomo Crypto IDX (user-provided authorized candles)', 'symbol':'Crypto IDX', 'timeframe':'1m', 'signal':'WAIT', 'reason':'NO DATA — upload authorized Binomo Crypto IDX CSV', 'candles':len(data),'history':list(HISTORY), 'graph':[]}
    if len(data)<35:
        base['reason']=f'Need at least 35 completed 1-minute candles; received {len(data)}'
        return base
    closes=[x['close'] for x in data]; e9=ema(closes,9); e21=ema(closes,21)
    macd_line=[a-b for a,b in zip(ema(closes,12),ema(closes,26))]
    macd_sig=ema(macd_line,9)
    current_rsi=rsi(closes)
    bullish=int(e9[-1]>e21[-1])+int(macd_line[-1]>macd_sig[-1])+int(current_rsi>55)
    bearish=int(e9[-1]<e21[-1])+int(macd_line[-1]<macd_sig[-1])+int(current_rsi<45)
    signal='UP' if bullish==3 else 'DOWN' if bearish==3 else 'WAIT'
    key=(data[-1]['time'],signal)
    if key!=LAST_KEY:
        HISTORY.append({'time':data[-1]['time'],'signal':signal,'rsi':round(current_rsi,2)})
        LAST_KEY=key
    base.update(signal=signal, reason='Indicators agree' if signal!='WAIT' else 'Mixed indicators', price=closes[-1],rsi=round(current_rsi,2),ema9=round(e9[-1],5),ema21=round(e21[-1],5),macd=round(macd_line[-1],6),macd_signal=round(macd_sig[-1],6), last_candle=data[-1]['time'],history=list(HISTORY),graph=data[-120:])
    return base

@app.get('/')
def root(): return {'status':'running','market':'Binomo Crypto IDX only','live_feed_connected':False,'note':'Upload authorized completed candles; no exchange substitution'}

@app.get('/signal')
def signal(): return analysis()

@app.post('/candles')
async def upload_candles(file: UploadFile=File(...), x_upload_token: str | None=Header(default=None)):
    expected=os.getenv('UPLOAD_TOKEN')
    if not expected:
        raise HTTPException(503,'Set UPLOAD_TOKEN in Render environment before uploading')
    if x_upload_token!=expected:
        raise HTTPException(401,'Invalid upload token')
    raw=await file.read()
    if len(raw)>2_000_000: raise HTTPException(413,'CSV too large (2 MB maximum)')
    try:
        reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
        rows=[]
        for r in reader:
            r={str(k).strip().lower():v for k,v in r.items() if k is not None}
            stamp=r.get('time') or r.get('timestamp') or r.get('date')
            if not stamp: raise ValueError('Missing time/timestamp/date column')
            o,h,l,c=[float(r[k]) for k in ('open','high','low','close')]
            if not all(math.isfinite(v) for v in (o,h,l,c)) or min(o,h,l,c)<=0 or h<max(o,c,l) or l>min(o,c,h):
                raise ValueError('Invalid OHLC values')
            rows.append({'time':str(stamp),'open':o,'high':h,'low':l,'close':c})
        if not rows: raise ValueError('No candle rows')
        if len(rows)>1500: rows=rows[-1500:]
        if len({x['time'] for x in rows})!=len(rows): raise ValueError('Duplicate timestamps')
        if rows!=sorted(rows,key=lambda x:x['time']): raise ValueError('Candles must be in chronological order')
    except (ValueError,KeyError,UnicodeError) as e:
        raise HTTPException(400,f'Invalid CSV: {e}')
    CANDLES.clear(); CANDLES.extend(rows); HISTORY.clear()
    global LAST_KEY
    LAST_KEY=None
    return {'accepted':len(rows),'source':'User-provided Binomo Crypto IDX candles','signal':analysis()['signal']}
