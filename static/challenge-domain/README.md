# `showdown.lebene.pl` — Async Challenge link domain

Static host for Universal Links (iOS) + App Links (Android), per ADR-0003. No
backend logic — these files are served raw from the subdomain docroot.

## Deploy

Serve the contents of this directory as the docroot of `showdown.lebene.pl`
(seohost subdomain, own HTTPS cert). Mirror the existing rsync/SSH deploy with a
different `REMOTE_DIR`. The `.well-known/*` files MUST be served:

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
- Enable a **TTL policy** on the `c` collection group, field `expiresAt`
  (Firestore console → TTL). Records self-delete 30 days after creation.
