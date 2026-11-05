import asyncio
import os
import time
from collections import deque
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title='50-Coin Crypto Market Analyzer')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['GET'], allow_headers=['*'])

# Fixed, transparent basket of 50 spot USDT pairs; not a dynamic market-cap ranking.
SYMBOLS = '''BTC ETH BNB SOL XRP DOGE ADA AVAX LINK LTC BCH DOT UNI ATOM NEAR APT ARB OP INJ SUI FIL ETC XLM HBAR ALGO ICP VET AAVE RUNE GRT SAND MANA THETA EGLD FTM CRV COMP MKR SNX ZEC DASH XTZ EOS KAVA CHZ ENJ ZIL 1INCH BAT LRC'''.split()
SYMBOLS = [s + 'USDT' for s in SYMBOLS]
BASE_URLS = ['https://api.binance.com', 'https://data-api.binance.vision']
CACHE_SECONDS = 60
_cache = {'at': 0.0, 'payload': None}
_lock = asyncio.Lock()
_history = deque(maxlen=180)


def ema(values, period):
    if len(values) < period:
        return None
    e = sum(values[:period]) / period
    k = 2 / (period + 1)
    for x in values[period:]:
        e = x * k + e * (1 - k)
    return e


def rsi(values, period=14):
    if len(values) <= period:
        return None
    diffs = [values[i] - values[i-1] for i in range(1, len(values))]
    gains = [max(x, 0) for x in diffs]
    losses = [max(-x, 0) for x in diffs]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(diffs)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    return 100 - 100 / (1 + avg_gain / avg_loss)


def macd(values):
    if len(values) < 35:
        return None
    # EMA MACD series using conventional 12/26 spans, signal EMA9.
    fast = sum(values[:12]) / 12
    slow = sum(values[:26]) / 26
    series = []
    for i, price in enumerate(values):
        if i >= 12:
            fast = price * (2/13) + fast * (11/13)
        if i >= 26:
            slow = price * (2/27) + slow * (25/27)
            series.append(fast - slow)
    if len(series) < 9:
        return None
    return series[-1], ema(series, 9)


def analyze(symbol, candles):
    # Last row can still be forming: exclude it for stable completed-candle signals.
    completed = candles[:-1]
    closes = [float(c[4]) for c in completed]
    if len(closes) < 45:
        return None
    r = rsi(closes)
    e9, e21 = ema(closes, 9), ema(closes, 21)
    m = macd(closes)
    if r is None or m is None:
        return None
    mval, msig = m
    votes = [1 if e9 > e21 else -1, 1 if mval > msig else -1, 1 if r > 55 else (-1 if r < 45 else 0)]
    score = sum(votes)
    signal = 'UP' if score >= 2 else ('DOWN' if score <= -2 else 'WAIT')
    return {'symbol': symbol.replace('USDT', ''), 'signal': signal, 'score': score,
            'rsi': round(r, 1), 'ema9': round(e9, 8), 'ema21': round(e21, 8),
            'macd': round(mval, 8), 'macd_signal': round(msig, 8),
            'last_close': closes[-1], 'candle_close_ms': int(completed[-1][6])}


async def fetch_one(client, sem, symbol):
    async with sem:
        for base in BASE_URLS:
            try:
                response = await client.get(base + '/api/v3/klines', params={'symbol': symbol, 'interval': '1m', 'limit': 110})
                if response.status_code != 200:
                    continue
                result = analyze(symbol, response.json())
                if result:
                    return result
            except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
                continue
    return None


async def refresh():
    sem = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=12.0, headers={'User-Agent': 'CryptoMarketBreadthDashboard/1.0'}) as client:
        results = await asyncio.gather(*(fetch_one(client, sem, s) for s in SYMBOLS))
    coins = [r for r in results if r is not None]
    up = sum(x['signal'] == 'UP' for x in coins)
    down = sum(x['signal'] == 'DOWN' for x in coins)
    wait = sum(x['signal'] == 'WAIT' for x in coins)
    valid = len(coins)
    # Breadth is normalized to -100..100. A missing coin never counts as WAIT.
    breadth = round(100 * (up - down) / valid, 1) if valid else None
    # Require at least 40/50 successfully analyzed markets before issuing direction.
    signal = ('UP' if breadth >= 25 else 'DOWN' if breadth <= -25 else 'WAIT') if valid >= 40 else 'WAIT'
    now = datetime.now(timezone.utc).isoformat()
    if valid >= 40:
        _history.append({'time': now, 'breadth': breadth})
    return {'market': 'PUBLIC_CRYPTO_BASKET_NOT_BINOMO', 'source': 'Binance public spot market data',
            'timeframe': '1m', 'requested': len(SYMBOLS), 'analyzed': valid,
            'up': up, 'down': down, 'wait': wait, 'breadth': breadth,
            'signal': signal, 'updated_at': now, 'coins': coins,
            'history': list(_history), 'status': 'OK' if valid >= 40 else 'INSUFFICIENT_DATA',
            'note': 'Public spot-market breadth only. Not Binomo Crypto IDX or a next-candle prediction.'}


@app.get('/')
def root():
    return {'status': 'running', 'app': '50-Coin Crypto Market Analyzer', 'not_binomo': True}


@app.get('/signal')
async def signal():
    async with _lock:
        now = time.monotonic()
        if _cache['payload'] is not None and now - _cache['at'] < CACHE_SECONDS:
            return _cache['payload']
        try:
            payload = await refresh()
            _cache['payload'] = payload
            _cache['at'] = time.monotonic()
            return payload
        except Exception:
            return {'market': 'PUBLIC_CRYPTO_BASKET_NOT_BINOMO', 'status': 'ERROR',
                    'signal': 'WAIT', 'breadth': None, 'coins': [], 'history': list(_history),
                    'note': 'Market data unavailable; no direction inferred.'}
