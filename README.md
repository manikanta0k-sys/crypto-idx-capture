# Crypto IDX Capture Lab (research MVP)

## GitHub Pages
Upload `index.html` to the root of a new repository. Settings > Pages > Deploy from a branch > main > /(root).

## Mac Chrome
Open Binomo Crypto IDX in a tab and set 1-minute candles. Open this app in another tab. Click Share Chrome tab, select the Binomo tab, and explicitly share it. The app samples visible pixels every 2–30 seconds. You can drag a crop rectangle around the chart, and stop sharing at any time. The browser may not support capture in all configurations.

## iPhone
Open the hosted app in Safari, use the screenshot file picker, select an image from Photos/Files, and drag to crop the chart region. Screen sharing is not expected to work from iPhone Safari.

## Important limitations
This is a **capture and observation prototype**, not a trading signal bot. Green/red pixel counts are not candles, OHLC data, RSI, MACD, or predicted market direction. The display deliberately remains WAIT. Cropping avoids interface artifacts but cannot fix these limitations. No automatic trading, credentials, backend, cloud uploads, or API calls. Captures and history exist only in the open page; CSV export saves local observations. Reloading clears the history.

The Binomo Crypto IDX index is proprietary; public numeric OHLC data access is not verified. To develop reliable technical indicators, acquire valid numeric candle data with permission, verify timestamps, and backtest out-of-sample.
