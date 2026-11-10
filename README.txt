Crypto 10 Fusion Pro V5.5 — FREE SMART INSIGHTS + OPTIONAL ONLINE AI VISION
=========================================================================

WHAT IS NEW
- Preserves all V5.4 features (20 completed candle minimum, 18 estimated indicators,
  5:06 screenshot -> 5:08 target timing, Binance compact box, screenshot upload,
  comparison and other hidden sections, freshness and pattern/reversal warnings).
- NEW FREE Local Second Opinion runs automatically after valid screenshot/CSV
  analysis. No accounts, billing, network or API key required. It is rule-based,
  not an online machine-learning model or guaranteed next candle prediction.
- NEW optional Online AI Vision analyzes a manually approved screenshot using
  Google Gemini 2.5 Flash-Lite free tier through YOUR Cloudflare Worker.
  Online AI is not activated automatically because you must consent to sharing
  your screenshot and set up the free proxy. No API key is ever in GitHub HTML.
- The optional online AI analyzes only your uploaded image. It CANNOT watch live
  Binomo Crypto IDX candles; no authorized Binomo live feed is connected.

DEPLOY DASHBOARD (works without cloud AI)
1. Upload index.html and fusion-indicators.js to your existing GitHub Pages
   repository's root, replacing earlier versions.
2. Open https://manikanta0k-sys.github.io/crypto-idx-capture/?v=55
3. Select a fresh Binomo screenshot. Existing automatic analysis and the NEW
   Free Local Insights will update without any setup or cost.

OPTIONAL FREE-TIER REAL ONLINE VISION MODEL SETUP (Cloudflare + Gemini)
1. Go to https://aistudio.google.com/apikey and create a Gemini API key from a
   FREE-tier project. DO NOT enable billing or switch to paid tiers. Free-tier
   model availability/limits depend on Google's current rules and region.
2. Create a FREE Cloudflare Workers account at https://dash.cloudflare.com/.
   Open Workers & Pages > Create > Worker, create and deploy a Worker.
3. Edit the Worker code and replace it with the contents of cloudflare-worker.js.
   Deploy. This Worker requires only Cloudflare's free Workers plan.
4. In your Worker > Settings > Variables and Secrets add TWO SECRET variables:
   GEMINI_API_KEY   = the Google key from step 1 (never paste into GitHub)
   AI_ACCESS_TOKEN = a LONG random personal passcode of your choosing.
   Optional plain variable DASHBOARD_ORIGIN = https://manikanta0k-sys.github.io
5. Re-deploy if prompted. Get your Worker HTTPS URL, e.g.
   https://your-worker.username.workers.dev/analyze
6. In your GitHub Pages dashboard expand 'Optional Online AI Vision', paste
   the WORKER URL (not the API key), enter your Worker access passcode, check
   consent, upload a FRESH screenshot, and tap 'Analyze Screenshot Online'.
7. AI explanation appears below. If your free quota is exhausted, an error
   appears and no online result is shown. The local analysis keeps working.

SECURITY AND PRIVACY
- NEVER paste Gemini API keys into index.html, browser JavaScript, or GitHub.
- The dashboard stores only your public Worker URL in the browser, NOT the
  access passcode; you must enter the passcode each visit.
- Screenshots are sent to Google through your Worker ONLY if you tick consent
  and tap Analyze Online. The model's free tier may use submitted content for
  product improvement; avoid sensitive details in screenshots.
- Worker checks a specific browser origin + a private passcode. This is a
  basic personal-use safeguard, not enterprise-grade protection. Do not
  publish your passcode or use this with a public high-traffic website.
- If your accounts are switched to paid plans, billing may apply. Stay on
  FREE tiers; limits and pricing can change.

LIMITATIONS
- No API provider can infer exact next Binomo Crypto IDX candles just by
  seeing Binance quotes or one screenshot. The 5:08 target is an early estimate
  based on an earlier screenshot; upload new data to verify after 5:07 closes.
- Minimum 20 extracted completed candles, but many 18 indicators need more.
- Values from screenshots are approximate (pixel-relative), not true OHLC.
- No automatic trading, no guaranteed accuracy or win percentages.
- Verify on iPhone Chrome after deployment; GitHub Pages must serve BOTH files.
