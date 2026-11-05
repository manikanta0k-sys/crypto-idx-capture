CRYPTO 10 MONITOR — iPhone deployment

1. Back up existing files in GitHub repo manikanta0k-sys/crypto-idx-capture.
2. Replace main.py, requirements.txt and index.html in the repository ROOT with these files. Commit changes.
3. Render service: Build command `pip install -r requirements.txt`; Start command `uvicorn main:app --host 0.0.0.0 --port $PORT`.
4. Wait for Render Live, then open https://crypto-idx-capture-1.onrender.com/api/market . It should return JSON with 10 coins. If it reports WAIT or errors, the upstream API may be inaccessible.
5. GitHub Settings > Pages: Deploy from branch main, folder /(root). Check Actions for successful deployment.
6. Open https://manikanta0k-sys.github.io/crypto-idx-capture/?v=fresh-v2-20261105 in Safari. If an installed PWA shows old content, use Safari and clear site data or remove outdated service worker registration.

Data: Binance public spot USDT pairs. NOT Binomo Crypto IDX. 60-second auto refresh while page open. Render free service may sleep and wake slowly.

PDF methods: PSAR(0.02,0.2) + BB midline(20), Heikin Ashi candle, support/resistance approximate range bounce, AO(5,34) + RSI(14) simultaneous 50 and zero cross.
The range method is an approximation; PDFs do not establish precise programmable thresholds. Strategies are not validated on Binomo Crypto IDX.

Buy/sell percentages: based on last five completed 1-minute candle taker buy quote volume / total quote volume, remaining volume counted as taker sell. NOT order-book depth, not number of buyers or sellers.

Known limitations: fixed 10-symbol list, no top-10 market-cap auto-selection; markets can be unavailable by region. Free Render may cold-start. Some coin indicators may show WAIT often because PDF rules require simultaneous crosses. No automated trading or success probabilities.
