50-COIN CRYPTO MARKET ANALYZER — SETUP

WARNING: This analyzes public Binance spot-market prices. It is NOT Binomo Crypto IDX.

1. BACK UP existing GitHub files first.
2. Replace main.py and requirements.txt in the root of your existing GitHub repository.
3. Replace index.html in the same repository root.
4. Commit changes. If Render auto-deploys from GitHub, wait until the service is Live.
5. Render start command: uvicorn main:app --host 0.0.0.0 --port $PORT
6. Verify backend: https://crypto-idx-capture-1.onrender.com/signal
7. Verify website: https://manikanta0k-sys.github.io/crypto-idx-capture/?v=50
8. If the old website persists, check GitHub Settings > Pages and the service worker cache.

Data: Binance public REST API, 50 fixed USDT spot pairs. A few may be unavailable or delisted; missing markets are excluded. At least 40 valid markets required for UP/DOWN. Backend cache is 60s; Render free services may sleep and history resets on restart. Binance access may be geographically restricted.

No API key, login, screenshot or trading permissions required. No automatic trading.

Security: the public /signal endpoint does not need credentials. Do not place any exchange login/password in these files.
