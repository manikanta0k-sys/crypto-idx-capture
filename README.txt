Crypto 10 + Binomo Crypto IDX Screenshot Analysis (experimental)

FILES TO REPLACE IN YOUR EXISTING GITHUB REPOSITORY ROOT:
  index.html
  main.py
  requirements.txt

Render: Build: pip install -r requirements.txt
Render: Start: uvicorn main:app --host 0.0.0.0 --port $PORT
Render: Manual Deploy > Deploy latest commit, if needed.
GitHub Pages: Settings > Pages > Deploy from branch main / (root).

TEST:
GET https://crypto-idx-capture-1.onrender.com/api/market
POST https://crypto-idx-capture-1.onrender.com/api/analyze-screenshot (multipart form field named file)
Open your GitHub Pages dashboard with ?v=shot2 after deploy.

Screenshot: PNG/JPEG/WebP <= 6 MB. Screenshot is sent to Render for transient analysis and is not stored by this code. Crop out personal/account details before upload. The visual analysis detects color runs and is NOT verified candlestick recognition, NOT indicator calculations, and NOT a reliable 2-3 minute forecast. It abstains with WAIT when unclear. Results must not be used as trading instructions.
Kraken market data still updates every 60 seconds while the page is visible.
