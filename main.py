from datetime import datetime, timezone
import logging
import os
import time

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Crypto IDX Signal Diagnostics", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://manikanta0k-sys.github.io"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("signals")

BINANCE_URL = "https://api.binance.com/api/v3/klines"
SYMBOL = "BTCUSDT"


def fetch_candles():
    """Return (closed candles, safe diagnostic). No credentials are used."""
    try:
        response = requests.get(
            BINANCE_URL,
            params={"symbol": SYMBOL, "interval": "1m", "limit": 120},
            timeout=12,
            headers={"User-Agent": "CryptoIDX-Diagnostics/2.0"},
        )
    except requests.exceptions.Timeout:
        return None, {"ok": False, "reason": "upstream_timeout"}
    except requests.exceptions.ConnectionError:
        return None, {"ok": False, "reason": "upstream_connection_error"}
    except requests.exceptions.RequestException:
        return None, {"ok": False, "reason": "upstream_request_error"}

    if response.status_code != 200:
        log.warning("Binance returned HTTP %s", response.status_code)
        return None, {
            "ok": False, "reason": "upstream_http_error",
            "http_status": response.status_code,
            "hint": "HTTP 451/403 can indicate geographic or service access restrictions" if response.status_code in (403, 451) else "Check upstream status and Render logs",
        }

    try:
        raw = response.json()
        if not isinstance(raw, list):
            return None, {"ok": False, "reason": "unexpected_upstream_format"}
        now_ms = int(time.time() * 1000)
        closed = [row for row in raw if isinstance(row, list) and len(row) >= 7 and int(row[6]) < now_ms]
        if len(closed) < 50:
            return None, {"ok": False, "reason": "insufficient_closed_candles", "count": len(closed)}
        if now_ms - int(closed[-1][6]) > 180_000:
            return None, {"ok": False, "reason": "stale_candles"}
        return closed, {"ok": True, "source": "Binance", "symbol": SYMBOL, "closed_candles": len(closed)}
    except (ValueError, TypeError, IndexError, KeyError):
        return None, {"ok": False, "reason": "invalid_candle_data"}


def ema_series(values, period):
    alpha = 2 / (period + 1)
    result = [values[0]]
    for price in values[1:]:
        result.append(alpha * price + (1 - alpha) * result[-1])
    return result


def rsi_wilder(values, period=14):
    changes = [values[i] - values[i - 1] for i in range(1, len(values))]
    gains = [max(x, 0.0) for x in changes]
    losses = [max(-x, 0.0) for x in changes]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(changes)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    return 100 - 100 / (1 + avg_gain / avg_loss)


@app.get("/")
def home():
    return {"status": "Python is running", "version": "2.0", "endpoints": ["/health", "/test-binance", "/signal", "/docs"]}


@app.get("/health")
def health():
    return {"status": "ok", "time_utc": datetime.now(timezone.utc).isoformat()}


@app.get("/test-binance")
def test_binance():
    candles, diagnostic = fetch_candles()
    return {"test": "binance_1m_closed_candles", **diagnostic}


@app.get("/signal")
def signal():
    candles, diagnostic = fetch_candles()
    if candles is None:
        return {"signal": "WAIT", "source": "Binance", "symbol": SYMBOL, **diagnostic}

    closes = [float(c[4]) for c in candles]
    ema9 = ema_series(closes, 9)[-1]
    ema21 = ema_series(closes, 21)[-1]
    rsi = rsi_wilder(closes)
    macd_line = [a - b for a, b in zip(ema_series(closes, 12), ema_series(closes, 26))]
    macd = macd_line[-1]
    macd_signal = ema_series(macd_line, 9)[-1]

    if ema9 > ema21 and rsi > 55 and macd > macd_signal:
        direction = "UP"
    elif ema9 < ema21 and rsi < 45 and macd < macd_signal:
        direction = "DOWN"
    else:
        direction = "WAIT"

    return {
        "signal": direction,
        "source": "Binance",
        "symbol": SYMBOL,
        "timeframe": "1m",
        "candle_closed_at_utc": datetime.fromtimestamp(int(candles[-1][6]) / 1000, timezone.utc).isoformat(),
        "price": closes[-1],
        "rsi": round(rsi, 2),
        "ema9": round(ema9, 4),
        "ema21": round(ema21, 4),
        "macd": round(macd, 6),
        "macd_signal": round(macd_signal, 6),
        "ok": True,
        "note": "Rule-based analysis, not a next-candle prediction; not Binomo Crypto IDX",
    }
