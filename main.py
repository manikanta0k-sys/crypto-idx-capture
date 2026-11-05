"""Read-only screenshot-derived OHLC analysis; never connects to Binomo."""
from datetime import datetime, timezone, timedelta
from math import tanh, isfinite
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os

app = FastAPI(title='Chart Signal Lab V9', version='9.0')
origins = [s.strip() for s in os.getenv('ALLOWED_ORIGINS','https://manikanta0k-sys.github.io,http://localhost:8000,http://127.0.0.1:8000').split(',') if s.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=['GET','POST'],allow_headers=['Content-Type'])

class Candle(BaseModel):
    open: float
    high: float
    low: float
    close: float

class Request(BaseModel):
    candles: List[Candle] = Field(min_length=35,max_length=1000)
    capture_time: datetime
    timeframe_seconds: int = 60

def ema(a,p):
    k=2/(p+1); v=a[0]; result=[]
    for x in a:
        v=x*k+v*(1-k);result.append(v)
    return result

def rsi(a,p=14):
    gain=sum(max(0,a[i]-a[i-1]) for i in range(1,p+1))/p
    loss=sum(max(0,a[i-1]-a[i]) for i in range(1,p+1))/p
    for i in range(p+1,len(a)):
        d=a[i]-a[i-1]
        gain=(gain*(p-1)+max(d,0))/p
        loss=(loss*(p-1)+max(-d,0))/p
    return 50 if loss==0 and gain==0 else (100 if loss==0 else 100-100/(1+gain/loss))

def fractal(cs):
    f=0
    for i in range(2,len(cs)-2):
        if all(cs[i].low<cs[i+d].low for d in (-2,-1,1,2)): f=1
        if all(cs[i].high>cs[i+d].high for d in (-2,-1,1,2)): f=-1
    return f

@app.get('/health')
def health():return {'status':'ok','source':'screenshot-derived candles only','version':'9.0'}

@app.post('/analyze')
def analyze(data:Request):
    if data.timeframe_seconds != 60:
        raise HTTPException(422,'V9 two-candle estimator requires a 60-second chart timeframe')
    cs=data.candles
    if any(not all(isfinite(x) for x in (c.open,c.high,c.low,c.close)) or c.high<max(c.open,c.close) or c.low>min(c.open,c.close) for c in cs):
        raise HTTPException(422,'Invalid OHLC candle values')
    capture=data.capture_time
    if capture.tzinfo is None:
        raise HTTPException(422,'capture_time must include timezone offset')
    capture=capture.astimezone(timezone.utc)
    age=(datetime.now(timezone.utc)-capture).total_seconds()
    close=[c.close for c in cs]; r=rsi(close)
    fast=ema(close,12);slow=ema(close,26)
    macd=[a-b for a,b in zip(fast,slow)];signal=ema(macd,9)
    hist=macd[-1]-signal[-1]
    last=cs[-1]; prev=cs[-2]; span=max(1e-9,last.high-last.low)
    body=(last.close-last.open)/span
    delta=(last.close-prev.close)/span
    clamp=lambda x:max(-1,min(1,x))
    score=clamp((r-50)/25)*.9+(1 if hist>0 else -1 if hist<0 else 0)*.8+(1 if macd[-1]>0 else -1 if macd[-1]<0 else 0)*.5+clamp(body)*.6+clamp(delta)*.4+fractal(cs)*.3
    base=capture.replace(second=0,microsecond=0)+timedelta(minutes=1)
    stale=age>60 or age < -10
    results=[]
    for i,threshold,scale in ((1,.85,18),(2,2.2,9)):
        direction='WAIT' if stale or abs(score)<threshold else ('UP' if score>0 else 'DOWN')
        up=round(max(0,min(100,50+scale*tanh(score/2.2))))
        results.append({'candle':i,'start':(base+timedelta(minutes=i-1)).isoformat(), 'end':(base+timedelta(minutes=i)).isoformat(), 'direction':direction, 'up_score':None if direction=='WAIT' else up,'down_score':None if direction=='WAIT' else 100-up, 'reason':'Screenshot timestamp is stale/future' if stale else 'Insufficient directional evidence' if direction=='WAIT' else 'Uncalibrated indicator agreement score'})
    return {'source':'Binomo screenshot-derived approximate OHLC (not live)', 'calibrated_probabilities':False, 'age_seconds':round(age,1),'indicators':{'rsi14':round(r,2),'macd':round(macd[-1],5),'histogram':round(hist,5),'fractal':fractal(cs)}, 'score':round(score,4), 'predictions':results,'warning':'Directional scores are not measured probabilities or verified future candle directions.'}
