# Crypto IDX Signal — PWA add-on

This package adds installability to your EXISTING GitHub Pages dashboard. It does not replace `index.html` or modify existing signal logic. It does not supply Binomo candle data or make signals live.

## GitHub Pages installation

1. Open https://github.com/manikanta0k-sys/crypto-idx-capture
2. Upload `manifest.webmanifest`, `sw.js`, and the entire `icons/` directory to the repository root (same folder as `index.html`). GitHub's **Add file → Upload files** supports uploading multiple files; make sure the icons retain their `icons/` directory path.
3. Open `index.html` → Edit (pencil).
4. Paste the contents of `HEAD-SNIPPET.txt` immediately BEFORE the existing `</head>` tag. If there is already a viewport meta tag, REPLACE that tag with the one in the snippet instead of adding a duplicate.
5. Paste the contents of `BODY-SNIPPET.txt` immediately BEFORE the existing `</body>` tag.
6. Commit changes to the branch used by GitHub Pages (often `main`). Wait for the Pages deployment to finish.
7. Open https://manikanta0k-sys.github.io/crypto-idx-capture/ and refresh.

## Install on iPhone

Open the site in Safari → Share → Add to Home Screen → enable **Open as Web App** if offered → Add.

## Install on Android

Open the site in Chrome → three-dot menu → Install app (or Add to Home screen) → Install/Add.

## Check deployment

Visit these URLs directly and confirm that neither shows a 404:
- https://manikanta0k-sys.github.io/crypto-idx-capture/manifest.webmanifest
- https://manikanta0k-sys.github.io/crypto-idx-capture/sw.js
- https://manikanta0k-sys.github.io/crypto-idx-capture/icons/icon-192.png

## Notes

- The service worker caches the app shell and previously fetched same-origin static assets, but **does not** make market data live or guarantee that signal features work offline.
- It uses network-first navigation to favor the latest dashboard version.
- The service worker only handles paths under `/crypto-idx-capture/` and does not intercept third-party API requests.
- GitHub Pages provides HTTPS, which is required for service workers.
- For a different repository name or custom domain, adjust `id`, `start_url`, `scope` in the manifest and `BASE` in `sw.js`.
- If install does not appear on Android, verify manifest, icons, HTTPS and service worker registration in Chrome DevTools → Application.
