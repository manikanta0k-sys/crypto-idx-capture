from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
from datetime import datetime, timezone

app = FastAPI(title="Crypto Signal Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://manikanta0k-sys.github.io"
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "Python is running"}

@app.get("/signal")
def signal():
    try:
        response = requests.get(
            "https://api.binance.com/api/v3/klines",
            params={
                "symbol": "BTCUSDT",
                "interval": "1m",
                "limit": 100
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        # Use completed candles only
        now = int(datetime.now(timezone.utc).timestamp() * 1000)
        closes = [
            float(c[4]) for c in data
            if int(c[6]) < now
        ]

        if len(closes) < 35:
            return {"signal": "WAIT", "reason": "Insufficient data"}

        def ema(values, period):
            result = values[0]
            multiplier = 2 / (period + 1)
            for price in values[1:]:
                result = (
                    price * multiplier
                    + result * (1 - multiplier)
                )
            return result

        def rsi(values, period=14):
            changes = [
                values[i] - values[i - 1]
                for i in range(1, len(values))
            ]
            gains = [max(x, 0) for x in changes]
            losses = [max(-x, 0) for x in changes]

            avg_gain = sum(gains[:period]) / period
            avg_loss = sum(losses[:period]) / period

            for i in range(period, len(gains)):
                avg_gain = (
                    avg_gain * (period - 1) + gains[i]
                ) / period
                avg_loss = (
                    avg_loss * (period - 1) + losses[i]
                ) / period

            if avg_loss == 0:
                return 100 if avg_gain > 0 else 50

            return 100 - 100 / (1 + avg_gain / avg_loss)

        ema9 = ema(closes, 9)
        ema21 = ema(closes, 21)
        rsi14 = rsi(closes)

        # MACD 12/26/9
        def ema_series(values, period):
            output = [values[0]]
            k = 2 / (period + 1)
            for value in values[1:]:
                output.append(
                    value * k + output[-1] * (1 - k)
                )
            return output

        fast = ema_series(closes, 12)
        slow = ema_series(closes, 26)
        macd_series = [
            a - b for a, b in zip(fast, slow)
        ]
        macd = macd_series[-1]
        macd_signal = ema_series(macd_series, 9)[-1]

        if ema9 > ema21 and rsi14 > 55 and macd > macd_signal:
            result = "UP"
        elif ema9 < ema21 and rsi14 < 45 and macd < macd_signal:
            result = "DOWN"
        else:
            result = "WAIT"

        return {
            "source": "Binance",
            "symbol": "BTCUSDT",
            "signal": result,
            "price": closes[-1],
            "rsi": round(rsi14, 2),
            "ema9": round(ema9, 2),
            "ema21": round(ema21, 2),
            "macd": round(macd, 4),
            "macd_signal": round(macd_signal, 4),
            "last_checked": datetime.now(
                timezone.utc
            ).isoformat()
        }

    except Exception:
        return {
            "signal": "WAIT",
            "reason": "Market data unavailable"
        }

