# `showdown.lebene.pl` — Async Challenge link domain

Static host for Universal Links (iOS) + App Links (Android), per ADR-0003. No
backend logic — these files are served raw from the subdomain docroot.

## Contents (what gets deployed)

The deploy script pushes everything in this directory **except** `README.md` and
`.DS_Store`:

| File                                     | Purpose                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `.well-known/apple-app-site-association` | iOS Universal Links — maps `/c/*` on this domain to the app (AASA)        |
| `.well-known/assetlinks.json`            | Android App Links — Digital Asset Links for `com.showdown.app`            |
| `.htaccess`                              | Forces `Content-Type: application/json` on the extension-less AASA file   |
| `index.html`                             | Fallback page shown to non-app visitors (store links)                    |

## Deploy

The subdomain has its own docroot on seohost (`/domains/showdown.lebene.pl/public_html`,
own Let's Encrypt cert; DNS is delegated to seohost's nameservers). Push this
directory there with:

```sh
scripts/deploy-challenge-domain.sh             # preflight guard + rsync + permissions + verify
scripts/deploy-challenge-domain.sh --preflight # safety guard only, no upload
scripts/deploy-challenge-domain.sh --verify    # check live headers only, no upload
```

A mandatory pre-flight guard runs before any upload and refuses to deploy a
broken or wrong-target state (invalid JSON, missing/placeholder AASA appID, wrong
docroot); see the `deploy-challenge-domain` skill. It then rsyncs the static files
(the `.htaccess` here forces `Content-Type: application/json` on the
extension-less AASA file) and verifies the live response. The `.well-known/*` files MUST be served:

- over HTTPS, no redirect,
- `apple-app-site-association` with `Content-Type: application/json` and **no**
  file extension.

## Placeholders to fill before going live

| File                                     | Placeholder                                                  | Value                                                                     |
| ---------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `.well-known/apple-app-site-association` | `REPLACE_WITH_APPLE_TEAM_ID`                                 | Apple Developer Team ID (the AASA `appID` is `<TeamID>.com.showdown.app`) |
| `.well-known/assetlinks.json`            | `REPLACE_WITH_DEBUG_SHA256`                                  | `keytool` SHA-256 of the debug keystore                                   |
| `.well-known/assetlinks.json`            | `REPLACE_WITH_RELEASE_OR_PLAY_APP_SIGNING_SHA256`            | Release / Play App Signing SHA-256                                        |
| `index.html`                             | `REPLACE_WITH_APP_STORE_URL` / `REPLACE_WITH_PLAY_STORE_URL` | Store listing URLs                                                        |

Android SHA-256 (Play App Signing): Play Console → Release → Setup → App signing.

## Verify

- iOS: Apple's AASA validator + `curl -I https://showdown.lebene.pl/.well-known/apple-app-site-association`
  returns `200` + `application/json`, no redirect.
- Android: `https://developers.google.com/digital-asset-links/tools/generator`
  or `adb shell pm verify-app-links`.
- Tap a `https://showdown.lebene.pl/c/<id>` link on each platform → app opens on
  the Challenge route.

## Firestore (separate from this host)

- Deploy rules: `firebase deploy --only firestore:rules` (rules in
  repo-root `firestore.rules`).
- **TTL is intentionally not used** (it requires the paid Blaze plan; we stay on
  free Spark). Expiry is enforced read-time by `gateChallenge`, and old docs are
  pruned on demand via `npm run challenges:cleanup`. If the project ever moves to
  Blaze, add a TTL policy on the `c` collection group, field `expiresAt`.
