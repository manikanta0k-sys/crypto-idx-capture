"""Crypto 10 public Kraken spot monitor. No trading, no Binomo integration."""
import asyncio
import math
import os
import time
import io
from PIL import Image, ImageOps
from datetime import datetime, timezone
from statistics import mean

import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Crypto 10 Market Monitor - Kraken Spot", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["https://manikanta0k-sys.github.io", "http://localhost:8000"], allow_methods=["GET", "POST"], allow_headers=["*"])

PAIRS = {"BTC": "XBTUSD", "ETH": "ETHUSD", "BNB": "BNBUSD", "SOL": "SOLUSD", "XRP": "XRPUSD", "ADA": "ADAUSD", "DOGE": "DOGEUSD", "TRX": "TRXUSD", "AVAX": "AVAXUSD", "LINK": "LINKUSD"}
BASE = "https://api.kraken.com/0/public"
TTL = 60
_cache = {"time": 0, "payload": None}
_lock = asyncio.Lock()


def sma(values, n):
    return mean(values[-n:]) if len(values) >= n else None


def rsi(closes, period=14):
    if len(closes) < period + 2:
        return None
    changes = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(0, d) for d in changes]
    losses = [max(0, -d) for d in changes]
    avg_gain = mean(gains[:period]); avg_loss = mean(losses[:period])
    out = []
    for i in range(period, len(changes)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        out.append(100 if avg_loss == 0 else 100 - 100 / (1 + avg_gain / avg_loss))
    return out[-2:] if len(out) >= 2 else None


def psar(candles):
    if len(candles) < 25:
        return None
    highs = [x[2] for x in candles]; lows = [x[3] for x in candles]
    rising = candles[1][4] >= candles[0][4]
    sar = lows[0] if rising else highs[0]
    extreme = highs[0] if rising else lows[0]
    af = 0.02
    for i in range(1, len(candles)):
        sar = sar + af * (extreme - sar)
        if rising:
            sar = min(sar, lows[i-1], lows[max(0, i-2)])
            if lows[i] < sar:
                rising = False; sar = extreme; extreme = lows[i]; af = 0.02
            elif highs[i] > extreme:
                extreme = highs[i]; af = min(0.2, af + 0.02)
        else:
            sar = max(sar, highs[i-1], highs[max(0, i-2)])
            if highs[i] > sar:
                rising = True; sar = extreme; extreme = highs[i]; af = 0.02
            elif lows[i] < extreme:
                extreme = lows[i]; af = min(0.2, af + 0.02)
    return sar


def strategies(c):
    closes = [x[4] for x in c]; highs = [x[2] for x in c]; lows = [x[3] for x in c]
    mids = [(x[2] + x[3]) / 2 for x in c]
    votes = {}
    # Bollinger middle = SMA20, PSAR acceleration .02 / .2
    middle = sma(closes, 20); sar = psar(c)
    votes["psar_bb"] = "UP" if sar is not None and middle is not None and closes[-1] > middle and closes[-2] <= mean(closes[-21:-1]) and sar < closes[-1] else ("DOWN" if sar is not None and middle is not None and closes[-1] < middle and closes[-2] >= mean(closes[-21:-1]) and sar > closes[-1] else "WAIT")
    # Heikin Ashi: last two completed candles same direction, small/no opposite wick
    ha_open = (c[0][1] + c[0][4]) / 2
    ha = []
    for bar in c:
        ha_close = (bar[1] + bar[2] + bar[3] + bar[4]) / 4
        ha_high = max(bar[2], ha_open, ha_close); ha_low = min(bar[3], ha_open, ha_close)
        ha.append((ha_open, ha_close, ha_high, ha_low))
        ha_open = (ha_open + ha_close) / 2
    a, b = ha[-2:]
    votes["heikin_ashi"] = "UP" if all(x[1] > x[0] and abs(x[2]-x[1]) <= (x[2]-x[3])*0.15 for x in (a,b)) else ("DOWN" if all(x[1] < x[0] and abs(x[3]-x[1]) <= (x[2]-x[3])*0.15 for x in (a,b)) else "WAIT")
    # Range ribbon heuristic: price rebounds near 30-bar support/resistance
    support = min(lows[-31:-1]); resistance = max(highs[-31:-1]); width = resistance-support
    if width <= 0:
        votes["range_ribbon"] = "WAIT"
    elif closes[-2] <= support + width*0.18 and closes[-1] > closes[-2] and closes[-1] < resistance - width*0.15:
        votes["range_ribbon"] = "UP"
    elif closes[-2] >= resistance - width*0.18 and closes[-1] < closes[-2] and closes[-1] > support + width*0.15:
        votes["range_ribbon"] = "DOWN"
    else:
        votes["range_ribbon"] = "WAIT"
    # Awesome oscillator SMA5(mid) - SMA34(mid), RSI14 crosses 50
    r = rsi(closes)
    ao_now = mean(mids[-5:]) - mean(mids[-34:]); ao_prev = mean(mids[-6:-1]) - mean(mids[-35:-1])
    votes["awesome_rsi"] = "UP" if r and r[-2] <= 50 < r[-1] and ao_prev <= 0 < ao_now else ("DOWN" if r and r[-2] >= 50 > r[-1] and ao_prev >= 0 > ao_now else "WAIT")
    return votes


async def get_ohlc(client, coin, pair):
    try:
        resp = await client.get(f"{BASE}/OHLC", params={"pair": pair, "interval": 1})
        resp.raise_for_status()
        data = resp.json()
        if data.get("error"):
            raise ValueError("; ".join(data["error"]))
        key = next((k for k in data["result"] if k != "last"), None)
        if not key:
            raise ValueError("No candle data")
        # Last row is the still-forming candle. Exclude it from indicators.
        rows = data["result"][key][:-1]
        c = [[int(x[0]), float(x[1]), float(x[2]), float(x[3]), float(x[4]), float(x[6])] for x in rows]
        if len(c) < 65:
            raise ValueError(f"Only {len(c)} closed candles")
        if time.time() - c[-1][0] > 240:
            raise ValueError("Latest completed candle is stale")
        votes = strategies(c)
        ups = sum(v == "UP" for v in votes.values()); downs = sum(v == "DOWN" for v in votes.values())
        signal = "UP" if ups >= 2 and downs == 0 else "DOWN" if downs >= 2 and ups == 0 else "WAIT"
        return coin, {"valid": True, "price": c[-1][4], "signal": signal, "strategies": votes, "volume_30m_base": round(sum(x[5] for x in c[-30:]), 5), "series": [round((x[4]/c[-31][4]-1)*100, 5) for x in c[-30:]], "buy_volume": None, "sell_volume": None}
    except Exception as exc:
        return coin, {"valid": False, "signal": "WAIT", "error": str(exc)[:240], "buy_volume": None, "sell_volume": None}


async def build_payload():
    limits = httpx.Limits(max_connections=5)
    async with httpx.AsyncClient(timeout=18, limits=limits, headers={"User-Agent": "Crypto10PublicMarketMonitor/2.0"}) as client:
        # Small batches reduce the chance of exchange rate limiting.
        results = []
        entries = list(PAIRS.items())
        for i in range(0, len(entries), 3):
            results.extend(await asyncio.gather(*(get_ohlc(client, coin, pair) for coin, pair in entries[i:i+3])))
            if i+3 < len(entries):
                await asyncio.sleep(0.4)
    coins = dict(results)
    good = [v for v in coins.values() if v.get("valid")]
    counts = {name: {"UP":0,"DOWN":0,"WAIT":0} for name in ("psar_bb", "heikin_ashi", "range_ribbon", "awesome_rsi")}
    for v in good:
        for name, signal in v["strategies"].items():
            counts[name][signal] += 1
    ups = sum(v["signal"] == "UP" for v in good); downs = sum(v["signal"] == "DOWN" for v in good)
    combined = "UP" if len(good) >= 8 and ups >= 6 and downs <= 1 else "DOWN" if len(good) >= 8 and downs >= 6 and ups <= 1 else "WAIT"
    series = [round(mean(v["series"][i] for v in good), 5) for i in range(30)] if len(good) >= 8 else []
    return {"source":"Kraken public USD spot markets (NOT Binomo IDX)", "timeframe":"1m closed candles", "generated_at":int(time.time()), "refresh_seconds":60, "valid_markets":len(good), "total_markets":len(PAIRS), "status":"ok" if len(good)==10 else "partial" if good else "unavailable", "coins":coins, "combined_signal":combined, "combined_series":series, "strategy_counts":counts, "combined_buy_pct":None, "disclaimer":"Public spot market indicators, not a prediction or Binomo IDX signal. Buy/sell trade volume not provided by OHLC feed."}


@app.get("/")
async def root():
    return {"service":"Crypto 10 Kraken market API", "market_endpoint":"/api/market", "docs":"/docs"}


@app.get("/api/market")
async def market():
    async with _lock:
        if _cache["payload"] is None or time.time() - _cache["time"] >= TTL:
            _cache["payload"] = await build_payload()
            _cache["time"] = time.time()
        return _cache["payload"]


@app.post("/api/analyze-screenshot")
async def analyze_screenshot(file: UploadFile = File(...)):
    """Conservative color-based visual heuristic; not OCR, OHLC or a forecast."""
    if file.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(400, "Use PNG, JPEG or WebP (iPhone screenshot PNG works).")
    raw = await file.read(6 * 1024 * 1024 + 1)
    if len(raw) > 6 * 1024 * 1024:
        raise HTTPException(413, "Screenshot must be under 6 MB.")
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
        if image.width * image.height > 12000000:
            raise ValueError("Image too large")
        image = image.convert("RGB")
    except Exception:
        raise HTTPException(400, "Unable to read screenshot")
    # Crop center to reduce headers, controls, labels. This is NOT a chart detector.
    w,h = image.size
    area = image.crop((int(w*.12), int(h*.22), int(w*.90), int(h*.79)))
    area.thumbnail((600, 350))
    w,h=area.size
    pix=area.load()
    # Find tall clusters of vivid red or green pixels by x-coordinate.
    # UI accents can resemble candles, so conservative abstention is essential.
    columns=[]
    for x in range(w):
        green=red=0
        for y in range(0,h,2):
            r,g,b=pix[x,y]
            if g>105 and g>r*1.34 and g>b*1.10 and g-r>35: green+=1
            elif r>125 and r>g*1.35 and r>b*1.16 and r-g>40: red+=1
        columns.append((green,red))
    threshold=max(3,int(h*.026))
    runs=[]; start=None; prev=None
    for x,(g,r) in enumerate(columns):
        typ='UP' if g>=threshold and g>r*2 else 'DOWN' if r>=threshold and r>g*2 else None
        if typ != prev:
            if prev and start is not None: runs.append((start,x-1,prev))
            start=x if typ else None;prev=typ
    if prev and start is not None:runs.append((start,w-1,prev))
    # Colored regions are not verified candles. Reject very wide UI elements.
    runs=[r for r in runs if 1 <= r[1]-r[0]+1 <= max(14,int(w*.045))]
    recent=runs[-10:]
    up=sum(r[2]=='UP' for r in recent)
    down=len(recent)-up
    last5=recent[-5:]
    last5_up=sum(r[2]=='UP' for r in last5)
    last5_down=len(last5)-last5_up
    issues=[]
    if len(runs)<18: issues.append('Too few candle-like shapes detected')
    if len(recent)<10: issues.append('Insufficient recent shapes')
    if max(up,down)<7: issues.append('Recent colors are mixed')
    # 2-minute bias is a descriptive, short-horizon visual momentum label only.
    # 3-minute outlook is more conservative because a single screenshot cannot
    # establish how momentum will persist across several future candles.
    two='WAIT'; three='WAIT'
    if not issues:
        if up>=8 and last5_up>=4: two='UP BIAS'
        elif down>=8 and last5_down>=4: two='DOWN BIAS'
        if up>=9 and last5_up==5: three='UP BIAS'
        elif down>=9 and last5_down==5: three='DOWN BIAS'
    agreement = max(up,down)/len(recent) if recent else 0
    # Evidence strength is NOT a calibrated chance of future price direction.
    strength='limited' if two=='WAIT' else 'moderate visual agreement'
    details=(f'{up} green-like and {down} red-like regions among the last '
             f'{len(recent)} detected shapes; {last5_up} green-like among the last {len(last5)}.')
    return {
        'instrument':'Binomo Crypto IDX (claimed by uploader; not independently verified)',
        'method':'Experimental pixel-color inspection; candle positions and OHLC not verified',
        'two_minute':{'bias':two,'evidence_strength':strength,'explanation':details},
        'three_minute':{'bias':three,'evidence_strength':'very limited' if three!='WAIT' else 'insufficient',
                        'explanation':'Longer horizon requires more evidence; '+details},
        'directional_bias':two.replace(' BIAS',''),
        'quality':{'detected_shapes':len(runs),'recent_shapes':len(recent),
                   'limitations':issues or ['Color shapes may include interface elements, not candles']},
        'indicator_verification':{'psar_bollinger':'not available', 'heikin_ashi':'not verified',
                                  'range_ribbon':'not verified', 'awesome_rsi':'not available'},
        'confidence_note':'Evidence strength describes agreement among detected colors, NOT probability of a correct forecast.',
        'warning':'Neither 2-minute nor 3-minute output is a validated prediction. Colors alone do not reveal OHLC, RSI, AO, PSAR, or support/resistance. Do not treat this as a trade recommendation.',
        'processed_at':int(time.time()), 'stored':False
    }
