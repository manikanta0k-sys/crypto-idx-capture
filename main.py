from datetime import datetime, timezone
import logging
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('crypto-signal')
app = FastAPI(title='Crypto Signal API')
app.add_middleware(CORSMiddleware, allow_origins=['https://manikanta0k-sys.github.io'], allow_methods=['GET'], allow_headers=['*'])
URL = 'https://api.binance.com/api/v3/klines'

def candles():
    response = requests.get(URL, params={'symbol': 'BTCUSDT', 'interval': '1m', 'limit': 120}, timeout=12)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise ValueError('Unexpected market-data response')
    now = int(datetime.now(timezone.utc).timestamp() * 1000)
    closed = [row for row in data if isinstance(row, list) and len(row) > 6 and int(row[6]) < now]
    if len(closed) < 40:
        raise ValueError('Insufficient completed candles')
    if now - int(closed[-1][6]) > 180000:
        raise ValueError('Market data is stale')
    return closed

def ema_series(values, period):
    k = 2 / (period + 1)
    output = [values[0]]
    for value in values[1:]:
        output.append(value * k + output[-1] * (1 - k))
    return output

def rsi(values, period=14):
    changes = [values[i] - values[i - 1] for i in range(1, len(values))]
    gains = [max(0, x) for x in changes]
    losses = [max(0, -x) for x in changes]
    gain = sum(gains[:period]) / period
    loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        gain = (gain * (period - 1) + gains[i]) / period
        loss = (loss * (period - 1) + losses[i]) / period
    if loss == 0:
        return 100.0 if gain else 50.0
    return 100 - 100 / (1 + gain / loss)

@app.get('/')
def home():
    return {'status': 'Python is running', 'endpoints': ['/health', '/test-binance', '/signal']}

@app.get('/health')
def health():
    return {'status': 'ok'}

@app.get('/test-binance')
def test_binance():
    try:
        rows = candles()
        return {'status': 'ok', 'source': 'Binance', 'closed_candles': len(rows), 'last_close_time_ms': int(rows[-1][6])}
    except requests.HTTPError as exc:
        code = exc.response.status_code if exc.response is not None else None
        logger.warning('Binance HTTP error: %s', code)
        return {'status': 'error', 'type': 'http_error', 'http_status': code}
    except requests.Timeout:
        return {'status': 'error', 'type': 'timeout'}
    except requests.RequestException:
        logger.exception('Binance network error')
        return {'status': 'error', 'type': 'network_error'}
    except (ValueError, IndexError, TypeError):
        logger.exception('Invalid or stale market data')
        return {'status': 'error', 'type': 'invalid_or_stale_data'}

@app.get('/signal')
def signal():
    try:
        rows = candles()
        prices = [float(row[4]) for row in rows]
        ema9 = ema_series(prices, 9)[-1]
        ema21 = ema_series(prices, 21)[-1]
        fast = ema_series(prices, 12)
        slow = ema_series(prices, 26)
        macd_values = [a - b for a, b in zip(fast, slow)]
        macd = macd_values[-1]
        macd_signal = ema_series(macd_values, 9)[-1]
        strength = rsi(prices)
        direction = 'WAIT'
        if ema9 > ema21 and strength > 55 and macd > macd_signal:
            direction = 'UP'
        elif ema9 < ema21 and strength < 45 and macd < macd_signal:
            direction = 'DOWN'
        return {'source': 'Binance', 'symbol': 'BTCUSDT', 'timeframe': '1m', 'signal': direction, 'price': prices[-1], 'rsi': round(strength, 2), 'ema9': round(ema9, 2), 'ema21': round(ema21, 2), 'macd': round(macd, 4), 'macd_signal': round(macd_signal, 4), 'candle_close_ms': int(rows[-1][6])}
    except Exception:
        logger.exception('Signal calculation failed')
        return {'signal': 'WAIT', 'reason': 'Market data or calculation unavailable'}
