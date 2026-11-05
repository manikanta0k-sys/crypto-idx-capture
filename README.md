# Crypto IDX Neon Monitor

One-file GitHub Pages dashboard with 10 Binance spot pairs, candlestick charts, RSI, MACD, Bollinger Bands, one descriptive market signal, Mac Chrome tab capture and iPhone screenshot upload.

## Deploy
1. Upload `index.html` to the root of the GitHub repository `crypto-idx-capture` (replace the old one).
2. GitHub → Settings → Pages → Deploy from a branch → main → /(root).
3. Visit `https://manikanta0k-sys.github.io/crypto-idx-capture/` after deployment.

## Notes
- Binance's `data-api.binance.vision` public REST endpoint must be accessible on your network. No API key required. This implementation polls fresh 1-minute candles every 30 seconds; it is **not** tick-by-tick streaming.
- UP/DOWN/WAIT is a market agreement indicator derived from 10 spot pairs and is **not** a probability or a validated forecast.
- The basket is **not** confirmed to match the composition or weights of Binomo Crypto IDX.
- Browser screen sharing needs a secure origin and user permission. Capture can include the whole selected tab; avoid sharing personal information.
- Uploaded screenshots remain in your browser. Capture history is session-only; CSV export saves timestamps and labels, not screenshots.
- No trading integration or broker credentials.
