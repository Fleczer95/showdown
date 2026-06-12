---
name: deploy-challenge-domain
description: Deploy or update the Async Challenge link domain (showdown.lebene.pl) — the static apple-app-site-association (AASA), assetlinks.json, .htaccess, and index.html that make challenge share links open the app (ADR-0003). Always runs a mandatory pre-flight safety guard before uploading, then verifies the live HTTPS response. Use when asked to "deploy the challenge domain", "update/push assetlinks or AASA", "add the Android SHA-256 to the link domain", "redeploy showdown.lebene.pl", or after editing anything under static/challenge-domain/.
---

# Deploy the Async Challenge link domain

`static/challenge-domain/` is hosted at `https://showdown.lebene.pl` (seohost
subdomain, own docroot + Let's Encrypt). Its `.well-known/*` files are what make
iOS Universal Links and Android App Links open the app on the `/c/*` route. A
broken or wrong-target upload silently breaks link verification, so **every
deploy goes through the guarded script — never rsync these files by hand.**

## Safety contract (non-negotiable)

The script `scripts/deploy-challenge-domain.sh` runs `preflight()` before any
upload and aborts on BLOCK. Do not bypass it.

**BLOCK (deploy refused, exit 1):**
- A required file is missing (`apple-app-site-association`, `assetlinks.json`, `index.html`, `.htaccess`).
- `apple-app-site-association` or `assetlinks.json` is not valid JSON.
- AASA still contains a `REPLACE_WITH` placeholder, or is missing the expected appID `RA73B8WWF4.com.showdown.app`.
- `assetlinks.json` is missing package `com.showdown.app`.
- The remote target is not the `showdown.lebene.pl` subdomain docroot (guards against clobbering the main lebene.pl site).

**WARN (safe, deploy proceeds — these are known-pending states):**
- `assetlinks.json` still has SHA-256 placeholders → Android App Links won't verify yet.
- `index.html` App Store URL is still a placeholder (fallback page only).

## Workflow

1. **Guard first.** Run and read the output:
   ```sh
   scripts/deploy-challenge-domain.sh --preflight
   ```
2. **Interpret.** Any BLOCK → fix the offending file and re-run the guard; do not deploy. Only WARNs → those are expected pending items, proceed.
3. **Deploy** (re-runs the guard, then rsync + permissions + verify):
   ```sh
   scripts/deploy-challenge-domain.sh
   ```
4. **Confirm the verify output:** AASA returns `HTTP/2 200` + `content-type: application/json` with **no** `location:` (redirect) header; `assetlinks.json` returns `200`. Public DNS may lag (the script also queries the authoritative ns1.seohost.pl and uses `--resolve`, so verification works before propagation).

To check the live server without uploading: `scripts/deploy-challenge-domain.sh --verify`.

## Common task: add the Android SHA-256 fingerprints

The Android `sha256_cert_fingerprints` array is a placeholder until real values exist:
- **Debug SHA** (`REPLACE_WITH_DEBUG_SHA256`): from `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android` (created on the first `npx expo run:android`). For dev-build link testing.
- **Release / Play App Signing SHA** (`REPLACE_WITH_RELEASE_OR_PLAY_APP_SIGNING_SHA256`): Play Console → Test and release → Setup → App signing → "App signing key certificate". Available after the first AAB is uploaded.

Edit `static/challenge-domain/.well-known/assetlinks.json`, replace the placeholder(s) (the array accepts multiple fingerprints), then run `scripts/deploy-challenge-domain.sh`. The SHA-256 WARN disappears once both are real.

## Notes

- Connection (host/user/port, key-based SSH) is hardcoded in the script and mirrors the sibling lebene site deploy.
- The script never uses `rsync --delete`, so unrelated files already on the docroot (e.g. `cgi-bin`) are left untouched.
- DNS (delegated to seohost nameservers) and SSL are seohost-managed; this skill only ships the static files.
- After changing identity constants (Team ID / package) in the link files, update the matching `EXPECTED_APPID` / `EXPECTED_PKG` in the script so the guard stays accurate.
