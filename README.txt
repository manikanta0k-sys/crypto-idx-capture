CRYPTO 10 MARKET MONITOR — IPHONE SETUP

1. Unzip this file using the iPhone Files app.
2. In GitHub repository manikanta0k-sys/crypto-idx-capture, upload index.html, main.py, requirements.txt into the repository ROOT. Overwrite existing files and commit to main.
3. GitHub Settings > Pages > Deploy from a branch > main > /(root) > Save.
4. In Render, open your existing Web Service. Verify it is connected to the same repository and main branch.
5. Render settings: Runtime Python; Build Command: pip install -r requirements.txt; Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
6. Deploy latest commit manually if automatic deploy is disabled. Wait for status Live.
7. Test https://crypto-idx-capture-1.onrender.com/api/market — should return JSON with status, coins, combined_signal.
8. Open https://manikanta0k-sys.github.io/crypto-idx-capture/?v=4

IMPORTANT: If Binance blocks Render's IP, the API will show unavailable and WAIT. This is an honest error; don't interpret placeholder bars as real data. The server tries two Binance public endpoints, but some environments block both. If so, the feed needs to be replaced with a supported provider.

This dashboard is public spot data, NOT Binomo Crypto IDX. 60-second refresh runs while Safari page is active.
