BINOMO CRYPTO IDX — AUTHORIZED DATA ONLY

1. GitHub repo: replace index.html with supplied index.html and commit.
2. Render repo: replace main.py, requirements.txt with supplied files and commit.
3. Render dashboard > Environment: set UPLOAD_TOKEN to a long random secret (NOT Binomo credentials).
4. Render build: pip install -r requirements.txt
5. Render start: uvicorn main:app --host 0.0.0.0 --port $PORT
6. Open your GitHub Pages app, select a CSV of ACTUAL authorized Binomo Crypto IDX completed 1m candles, enter UPLOAD_TOKEN, click Upload.
7. CSV header: time,open,high,low,close. At least 35 rows, ascending time order.
8. Example row structure (not real market data): 2026-11-05T12:00:00,100,101,99,100.5

IMPORTANT: No Binance, no fake candle data, no unofficial private Binomo API.
This version does NOT automatically fetch live Binomo data. New CSV must be uploaded when available.
Render free service restarts erase uploaded in-memory candles. For persistent production use, add a database.
The graph shows one actual Binomo Crypto IDX candle series, and the combined signal merges three indicators; it does not recreate Binomo's proprietary top-10 index formula.
This is a technical indicator, not a reliable next-candle prediction.
If your GitHub app uses a service worker, cached pages may need a refresh/reinstall after updating.
