CRYPTO 10 FUSION PRO V5.6 — SIMPLE SMART CANDLE ASSISTANT RESTORED
==================================================================

WHAT CHANGED FROM V5.5
- Original 4-box Smart Candle Assistant is back: Reversal Detector, Candle
  Pattern, Support/Resistance and Next Screenshot Timing.
- Removed large 3-step Target Candle panel and its confusing countdown.
- UP / DOWN / WAIT badge, explanation, and stale-screenshot warning remain.
- Screenshot upload still triggers automatic analysis; 20 completed candles
  is still the minimum for extraction (some indicators need more data).
- 18 estimated indicators, diagnostics, Binance compact status, and
  Free Local Smart Insights + Optional Cloudflare/Gemini AI remain available.

DEPLOY
1. Upload index.html and fusion-indicators.js together to GitHub Pages.
2. Open https://manikanta0k-sys.github.io/crypto-idx-capture/?v=56
3. Screenshot upload automatically starts analysis.

OPTIONAL ONLINE AI
- You can still use the existing cloudflare-worker.js and its configuration.
- API keys must NEVER be pasted into GitHub files or browser frontend code.
- Cloudflare/Google free-tier limits and availability may change.
- Screenshot sharing with AI is opt-in only.

LIMITATIONS
- The phone-clock countdown does not verify Binomo candle timestamps.
- A new screenshot is required to detect changes; no live Binomo connection.
- Screenshot-derived OHLC is pixel-estimated, not true OHLC.
- 18 indicator values might be incomplete with 20 candles.
- No guaranteed next-candle signal or win probability.
