CRYPTO 10 FUSION V5.2 — ALL-IN-ONE NEXT CANDLE MONITOR V1
Build date: 13 November 2026

FILES TO UPLOAD TO THE ROOT OF YOUR GITHUB PAGES REPOSITORY:
  index.html
  fusion-indicators.js
  advanced-chart-tools.js
  combined-22-indicators.js
  next-candle-engine.js
All five files must be in the SAME folder. Upload/commit them together; otherwise modules may not load.

ALTERNATIVE: Open Crypto_10_Fusion_Next_Candle_Standalone.html locally as a single-file dashboard.
For best browser compatibility, publish the above multi-file version via GitHub Pages.

WHAT THIS BUILD INCLUDES
- Existing Crypto 10 Fusion V5.2 interface and all original research widgets.
- Original Smart Candle Assistant V5.2 analysis code is BYTE-FOR-BYTE UNCHANGED.
- Existing 18 indicators + Aroon, Donchian, Choppiness and Keltner shown in one 22-indicator graph.
- Screenshot reader has a more flexible chart-area scanner. It still estimates colour-based candles, NOT verified Binomo quote OHLC.
- New Next Candle Monitor V1: precise IST clock, last close, target 1m candle, research direction UP/DOWN/WAIT, entry freshness window, late signal => WAIT.
- Screenshot chart-area dropdown (auto/standard/upper/middle/tight) and recheck button.
- Research signal journal stored locally on this browser; manual WIN/LOSS/TIE outcome controls; CSV export and later CSV matching.
- Historical 1m CSV backtest (requires at least 55 completed candles). It is not walk-forward validation or a forward guarantee.

IMPORTANT CLOCK EXAMPLE
7:41 PM screenshot: the 7:41 candle is still running and must be excluded.
The 7:42–7:43 target may be displayed, but the FINAL signal stays WAIT until a fresh screenshot just after 7:42:00 (or fresh timestamped CSV) supports it.
7:42:00–7:42:08: target is 7:42–7:43; a fresh scan MAY show UP/DOWN if all conservative checks pass. No late entries or auto trading.
At/after 7:43:00: compare the result from an actual completed candle. With screenshots this is a MANUAL outcome check. With matching later timestamped CSV, the journal can grade CSV signal outcomes.
A 1-minute expiry that starts after a delayed entry is not identical to the chart candle close. Verify broker expiry times separately.

DATA SOURCES / LIMITS
- Binomo Crypto IDX is a separate market from Binance coins. Binance readings are never used as Crypto IDX candle OHLC.
- Screenshot-derived candles may be incorrect; if too few/ambiguous, the system intentionally shows WAIT/DATA ERROR rather than an invented direction.
- For reliable indicator calculations, use timestamped user-authorized 1-minute OHLC CSV with columns time,open,high,low,close. CSV time is candle START time. Prices are not verified by this dashboard.
- NEVER interprets indicator vote fractions as win probabilities. No guaranteed 80% win rate.
- No official Binomo live connection, no trading automation, no guaranteed market data freshness.
- Screenshot quality can vary by phone, chart colors, crop, indicators, and candle zoom. Real-world reading success cannot be guaranteed.

TROUBLESHOOTING DATA ERROR
1. Use a clear 1-minute chart screenshot immediately after a minute boundary.
2. Show at least 25–40 candles; avoid toolbars, popups and overlays over the candles.
3. Crop to the candlestick chart using Photos if needed.
4. In Next Candle Monitor > Screenshot quality, try Auto / Upper / Tight and tap Recheck image.
5. If estimates remain unreadable, use properly timestamped OHLC CSV.

All analysis is educational/research/demo only, not a substitute for your own verification.
