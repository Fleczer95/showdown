#!/usr/bin/env python3
"""
Creates all ShowDown in-app purchases via App Store Connect API.
Run from anywhere: python3 .agents/app-store-connect-api/create_iap.py
Key file: AuthKey_TYBAQ9XDGV.p8 at repo root (gitignored via *.p8).
"""

import json
import time
import sys
import jwt
import requests
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

KEY_ID = "TYBAQ9XDGV"
ISSUER_ID = "2d8516f5-a643-4741-88a9-28bfe52778fd"
KEY_FILE = (Path(__file__).parent / "../../AuthKey_TYBAQ9XDGV.p8").resolve()
BUNDLE_ID = "com.showdown.app"
BASE_URL = "https://api.appstoreconnect.apple.com"

# ── Product definitions ───────────────────────────────────────────────────────
# All products from src/constants/iap.ts + metadata from src/data/store/index.ts
# enabled=True → active in features.ts; enabled=False → commented out (future use)

PRODUCTS = [
    # ShowDown IAP products are added per game mode during the content phase
    # (The Ladder / The Grid / The Opinion Poll / The Wheel packs + cosmetic themes).
    # Keep SKUs under the com.showdown.* namespace and mirror src/data/store.
    # Example:
    # {"sku": "com.showdown.ladder_history", "name": "History Ladder", "desc": "15 history questions.", "price": "1.99", "enabled": True},
    {"sku": "com.showdown.pack_ladder_ancient_history", "name": "Ancient History", "desc": "300 ancient history questions for The Ladder", "price": "2.49", "enabled": False},
    {"sku": "com.showdown.pack_drop_world_geography", "name": "World Geography", "desc": "180 world geography questions for The Drop", "price": "1.99", "enabled": False},
]

# Obsolete SKUs to delete on next run. Add product IDs here when a pack is removed
# from the PRODUCTS list above — the script will remove them from App Store Connect.
OBSOLETE_SKUS: list[str] = []

# ── Auth ──────────────────────────────────────────────────────────────────────

def make_token():
    private_key = KEY_FILE.read_text()
    now = int(time.time())
    token = jwt.encode(
        {"iss": ISSUER_ID, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        private_key,
        algorithm="ES256",
        headers={"kid": KEY_ID},
    )
    return token

def headers():
    return {"Authorization": f"Bearer {make_token()}", "Content-Type": "application/json"}

# ── API helpers ───────────────────────────────────────────────────────────────

def get(path, params=None):
    r = requests.get(f"{BASE_URL}{path}", headers=headers(), params=params)
    r.raise_for_status()
    return r.json()

def post(path, body):
    r = requests.post(f"{BASE_URL}{path}", headers=headers(), json=body)
    return r

def delete(path):
    r = requests.delete(f"{BASE_URL}{path}", headers=headers())
    return r

# ── Main logic ────────────────────────────────────────────────────────────────

def get_app_id():
    data = get("/v1/apps", params={"filter[bundleId]": BUNDLE_ID})
    apps = data.get("data", [])
    if not apps:
        print(f"ERROR: No app found for bundle ID {BUNDLE_ID}")
        sys.exit(1)
    app_id = apps[0]["id"]
    print(f"App ID: {app_id}")
    return app_id

def create_iap(app_id, product):
    body = {
        "data": {
            "type": "inAppPurchases",
            "attributes": {
                "name": product["name"],
                "productId": product["sku"],
                "inAppPurchaseType": "NON_CONSUMABLE",
                "reviewNote": "",
            },
            "relationships": {
                "app": {"data": {"type": "apps", "id": app_id}}
            },
        }
    }
    r = post("/v2/inAppPurchases", body)
    if r.status_code == 409:
        # Already exists — find its ID
        errors = r.json().get("errors", [])
        for e in errors:
            if e.get("code") == "ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE":
                # Fetch existing by listing app's IAPs
                existing = get(f"/v1/apps/{app_id}/inAppPurchasesV2",
                               params={"filter[productId]": product["sku"]})
                iaps = existing.get("data", [])
                if iaps:
                    iap_id = iaps[0]["id"]
                    print(f"  already exists (id={iap_id})")
                    return iap_id
        # fallback: search all
        existing = get(f"/v1/apps/{app_id}/inAppPurchasesV2",
                       params={"filter[productId]": product["sku"]})
        iaps = existing.get("data", [])
        if iaps:
            iap_id = iaps[0]["id"]
            print(f"  already exists (id={iap_id})")
            return iap_id
        print(f"  ERROR 409 but couldn't find existing: {r.text}")
        return None
    if r.status_code not in (200, 201):
        print(f"  ERROR creating IAP: {r.status_code} {r.text}")
        return None
    iap_id = r.json()["data"]["id"]
    print(f"  created (id={iap_id})")
    return iap_id

def add_localization(iap_id, product):
    body = {
        "data": {
            "type": "inAppPurchaseLocalizations",
            "attributes": {
                "name": product["name"],
                "locale": "en-US",
                "description": product["desc"],
            },
            "relationships": {
                "inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": iap_id}}
            },
        }
    }
    r = post("/v1/inAppPurchaseLocalizations", body)
    if r.status_code in (200, 201):
        print(f"  localization added")
    elif r.status_code == 409:
        print(f"  localization already exists")
    else:
        print(f"  ERROR localization: {r.status_code} {r.text}")

def set_price(iap_id, product):
    target_price = product["price"]

    # Fetch available price points for USA
    pp_resp = get(f"/v2/inAppPurchases/{iap_id}/pricePoints",
                  params={"filter[territory]": "USA", "limit": 200})
    price_points = pp_resp.get("data", [])

    # Find matching price point by float comparison
    match = None
    for pp in price_points:
        cp = pp["attributes"].get("customerPrice", "")
        try:
            if abs(float(cp) - float(target_price)) < 0.001:
                match = pp
                break
        except (ValueError, TypeError):
            pass

    if not match:
        print(f"  ERROR: no price point found for ${target_price} in USA")
        return

    pp_id = match["id"]
    local_id = "${p0}"

    body = {
        "data": {
            "type": "inAppPurchasePriceSchedules",
            "relationships": {
                "inAppPurchase": {"data": {"type": "inAppPurchases", "id": iap_id}},
                "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
                "manualPrices": {"data": [{"type": "inAppPurchasePrices", "id": local_id}]},
            },
        },
        "included": [
            {
                "type": "inAppPurchasePrices",
                "id": local_id,
                "attributes": {"startDate": None},
                "relationships": {
                    "inAppPurchasePricePoint": {"data": {"type": "inAppPurchasePricePoints", "id": pp_id}},
                    "territory": {"data": {"type": "territories", "id": "USA"}},
                },
            }
        ],
    }
    r = post("/v1/inAppPurchasePriceSchedules", body)
    if r.status_code in (200, 201):
        print(f"  price set to ${target_price}")
    elif r.status_code == 409:
        print(f"  price already set")
    else:
        print(f"  ERROR price: {r.status_code} {r.text}")

def delete_obsolete(app_id):
    """Delete IAPs whose product IDs are in OBSOLETE_SKUS. Used for IP cleanup."""
    if not OBSOLETE_SKUS:
        return 0, 0
    deleted, missing = 0, 0
    for sku in OBSOLETE_SKUS:
        existing = get(f"/v1/apps/{app_id}/inAppPurchasesV2",
                       params={"filter[productId]": sku})
        iaps = existing.get("data", [])
        if not iaps:
            print(f"[DELETE] {sku} — not found, skip")
            missing += 1
            continue
        iap_id = iaps[0]["id"]
        r = delete(f"/v2/inAppPurchases/{iap_id}")
        if r.status_code in (200, 204):
            print(f"[DELETE] {sku} (id={iap_id}) — removed")
            deleted += 1
        else:
            print(f"[DELETE] {sku} (id={iap_id}) — FAILED: {r.status_code} {r.text}")
    return deleted, missing

def main():
    print("=== ShowDown IAP Creator ===\n")
    app_id = get_app_id()
    print()

    # Delete obsolete first
    deleted, missing = delete_obsolete(app_id)
    if deleted or missing:
        print(f"\n  Removed: {deleted}, not present: {missing}\n")

    ok, skipped, failed = 0, 0, 0
    for product in PRODUCTS:
        status = "ACTIVE" if product["enabled"] else "FUTURE"
        print(f"[{status}] {product['name']} ({product['sku']}) ${product['price']}")
        iap_id = create_iap(app_id, product)
        if not iap_id:
            failed += 1
            continue
        add_localization(iap_id, product)
        set_price(iap_id, product)
        ok += 1
        print()

    print(f"\n=== Done: {ok} ok, {failed} failed, {deleted} obsolete removed ===")

if __name__ == "__main__":
    main()
