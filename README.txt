CRYPTO 10 — GITHUB + RENDER

1. Upload index.html, main.py, requirements.txt directly into the ROOT of your existing GitHub repository. Overwrite older files.
2. GitHub repository Settings > Pages: Deploy from a branch > main > /(root) > Save.
3. Render: Existing Web Service must point to this GitHub repo and main branch. Set Root Directory empty, Build Command: pip install -r requirements.txt
4. Render Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
5. Render: Manual Deploy > Deploy latest commit (unless automatic deployment occurs).
6. Check https://crypto-idx-capture-1.onrender.com/api/market. It should say source: Kraken and valid_markets > 0 if Render can reach Kraken.
7. Check https://manikanta0k-sys.github.io/crypto-idx-capture/?v=kraken2

No Binance. Kraken OHLC is public; some markets may be unsupported or blocked by the hosting provider. Data failures display unavailable/WAIT. 60-second server cache. Buy/sell executed trade volumes cannot be derived from OHLC, so the UI marks them unavailable. No trading execution and no Binomo IDX integration.
