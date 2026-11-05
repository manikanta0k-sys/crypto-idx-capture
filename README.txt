Crypto IDX Monitor — Neon Layout V4

1. Extract ZIP. Upload index.html, main.py, requirements.txt to the ROOT of your existing GitHub repository.
2. Commit changes. GitHub Pages: Settings > Pages > Deploy from branch > main > /(root).
3. In Render, connect the same repository and redeploy latest commit.
   Build: pip install -r requirements.txt
   Start: uvicorn main:app --host 0.0.0.0 --port $PORT
4. Check https://crypto-idx-capture-1.onrender.com/api/market
5. Open https://manikanta0k-sys.github.io/crypto-idx-capture/?v=neon4

The design resembles the supplied visual reference, but does NOT display fabricated 72% probabilities, fictional MACD/RSI values, or false Binomo live data. The central chart is a real normalized returns LINE graph, not fake candlesticks. Kraken public spot data is separate from Binomo IDX. Screenshot analysis is experimental and manually triggered.
