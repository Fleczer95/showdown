---
name: app-store-connect-api
description: 'App Store Connect REST API specialist for ShowDown. Covers authentication (JWT/ES256), verified endpoint mapping (v1/v2 mix), in-app purchase creation, localization, and pricing via the API. Includes the create_iap.py script that creates the ShowDown IAPs. Use when: App Store Connect, IAP management, adding products, pricing, AppStoreConnect API, create in-app purchases.'
source: showdown (custom)
---

# App Store Connect API — ShowDown

## Credentials

| Field     | Value                                                            |
| --------- | ---------------------------------------------------------------- |
| Key ID    | `TYBAQ9XDGV`                                                     |
| Issuer ID | `2d8516f5-a643-4741-88a9-28bfe52778fd`                           |
| Key file  | `AuthKey_TYBAQ9XDGV.p8` — repo root, covered by `*.p8` gitignore |
| App ID    | `6774886649` (numeric — used in API calls; create_iap.py also resolves it from the bundle ID) |
| Bundle ID | `com.showdown.app`                                              |

## Auth — JWT (Python)

```python
import jwt, time

KEY_ID    = "TYBAQ9XDGV"
ISSUER_ID = "2d8516f5-a643-4741-88a9-28bfe52778fd"
KEY_FILE  = "AuthKey_TYBAQ9XDGV.p8"  # repo root
BASE_URL  = "https://api.appstoreconnect.apple.com"

def make_token():
    now = int(time.time())
    return jwt.encode(
        {"iss": ISSUER_ID, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        open(KEY_FILE).read(),
        algorithm="ES256",
        headers={"kid": KEY_ID},
    )

def headers():
    return {"Authorization": f"Bearer {make_token()}", "Content-Type": "application/json"}
```

**Requirements:** `pip3 install PyJWT cryptography requests`

## Verified Endpoint Map

Apple's API mixes v1 and v2 — use exactly these (all others return 404):

| Operation              | Method | Endpoint                                                              |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| Find app by bundle ID  | GET    | `/v1/apps?filter[bundleId]=com.showdown.app`                         |
| List app's IAPs        | GET    | `/v1/apps/{appId}/inAppPurchasesV2`                                   |
| Create IAP             | POST   | `/v2/inAppPurchases`                                                  |
| Get IAP                | GET    | `/v2/inAppPurchases/{id}`                                             |
| Get price points (USA) | GET    | `/v2/inAppPurchases/{id}/pricePoints?filter[territory]=USA&limit=200` |
| Create localization    | POST   | `/v1/inAppPurchaseLocalizations`                                      |
| Create price schedule  | POST   | `/v1/inAppPurchasePriceSchedules`                                     |

## Create IAP

```python
body = {
    "data": {
        "type": "inAppPurchases",
        "attributes": {
            "name": "Pack Name",
            "productId": "com.showdown.ladder_history",
            "inAppPurchaseType": "NON_CONSUMABLE",
            "reviewNote": "",
        },
        "relationships": {
            "app": {"data": {"type": "apps", "id": "6774886649"}}
        },
    }
}
r = requests.post(f"{BASE_URL}/v2/inAppPurchases", headers=headers(), json=body)
# 201 = created, 409 = already exists
```

## Create Localization

```python
body = {
    "data": {
        "type": "inAppPurchaseLocalizations",
        "attributes": {
            "name": "Pack Name",
            "locale": "en-US",
            "description": "Short description.",
        },
        "relationships": {
            "inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": IAP_ID}}
        },
    }
}
r = requests.post(f"{BASE_URL}/v1/inAppPurchaseLocalizations", headers=headers(), json=body)
```

## Set Price (USD, auto-converts globally)

```python
# Step 1 — find price point
pp_resp = requests.get(
    f"{BASE_URL}/v2/inAppPurchases/{iap_id}/pricePoints",
    headers=headers(),
    params={"filter[territory]": "USA", "limit": 200}
)
pp = next(
    p for p in pp_resp.json()["data"]
    if abs(float(p["attributes"]["customerPrice"]) - float(target_price)) < 0.001
)

# Step 2 — create price schedule
# IMPORTANT: type must be inAppPurchasePrices (not inAppPurchaseManualPrices)
# IMPORTANT: local id must use ${...} format
body = {
    "data": {
        "type": "inAppPurchasePriceSchedules",
        "relationships": {
            "inAppPurchase":  {"data": {"type": "inAppPurchases",  "id": iap_id}},
            "baseTerritory":  {"data": {"type": "territories",     "id": "USA"}},
            "manualPrices":   {"data": [{"type": "inAppPurchasePrices", "id": "${p0}"}]},
        },
    },
    "included": [{
        "type": "inAppPurchasePrices",
        "id": "${p0}",
        "attributes": {"startDate": None},
        "relationships": {
            "inAppPurchasePricePoint": {"data": {"type": "inAppPurchasePricePoints", "id": pp["id"]}},
            "territory":              {"data": {"type": "territories",              "id": "USA"}},
        },
    }],
}
r = requests.post(f"{BASE_URL}/v1/inAppPurchasePriceSchedules", headers=headers(), json=body)
# 201 = created, 409 = already set
```

## Bulk IAP Script

**File:** `create_iap.py` (this skill's directory)
**Run from repo root:** `python3 ~/.claude/skills/app-store-connect-api/create_iap.py`

The script creates the ShowDown IAPs in one run:

- Handles existing products gracefully (409 → fetches existing ID, continues)
- Adds en-US localization (name + description from `src/i18n/locales/en.json`)
- Sets USD price with automatic global conversion via `baseTerritory: USA`
- `enabled: True` = currently active in app; `enabled: False` = future product (still created)
- Re-runnable safely at any time

## Product Catalog

All products are `NON_CONSUMABLE`. Source of truth lives in `src/data/store/`
(`catalog.ts` aggregates `themes.ts` and the per-mode packs).

Price tiers used: `0.99` · `1.49` · `1.99` · `2.49` · `2.99` · `3.49` · `3.99` (USD)

Product ID pattern: `com.showdown.{mode}_{name}` (e.g. `com.showdown.ladder_history`,
`com.showdown.theme_studio_gold`).

### Products

ShowDown's catalog is **empty pending the content/monetization phase**. Populate the
`PRODUCTS` list in `create_iap.py` (and `src/data/store`) with the four modes' packs
(The Ladder / The Grid / The Opinion Poll / The Wheel) and cosmetic themes, then
re-run the script.

## Common Pitfalls

| Mistake                                       | Fix                                   |
| --------------------------------------------- | ------------------------------------- |
| Using `/v2/inAppPurchaseLocalizations`        | Use `/v1/inAppPurchaseLocalizations`  |
| Using `/v2/inAppPurchasePriceSchedules`       | Use `/v1/inAppPurchasePriceSchedules` |
| `type: inAppPurchaseManualPrices` in included | Use `type: inAppPurchasePrices`       |
| Local id `"$p0"`                              | Must be `"${p0}"` format              |
| Price string comparison `"1.99" == "1.9"`     | Use float comparison with tolerance   |
