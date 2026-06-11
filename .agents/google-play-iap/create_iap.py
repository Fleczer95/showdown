#!/usr/bin/env python3
"""
Creates all ShowDown in-app purchases via Google Play Monetization API (v3).
This is the "new publishing API" that replaces the legacy inappproducts API.
Run from anywhere: python3 .agents/google-play-iap/create_iap.py
Key file: google-play-key.json at repo root (gitignored).
"""

import sys
import json
import time
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ── Config ────────────────────────────────────────────────────────────────────

PACKAGE_NAME = "com.showdown.app"
KEY_FILE = (Path(__file__).parent / "../../google-play-key.json").resolve()
SCOPES = ['https://www.googleapis.com/auth/androidpublisher']
REGIONS_VERSION = "2025/03" 

# ── Product definitions ───────────────────────────────────────────────────────
# All products from src/constants/iap.ts + metadata from src/data/store/index.ts
# enabled=True → active in features.ts; enabled=False → future use

PRODUCTS = [
    # ShowDown IAP products are added per game mode during the content phase
    # (The Ladder / The Grid / The Opinion Poll / The Wheel packs + cosmetic themes).
    # Keep SKUs under the com.showdown.* namespace and mirror src/data/store.
    # Example:
    # {"sku": "com.showdown.ladder_history", "name": "History Ladder", "desc": "15 history questions.", "price": "1.99", "enabled": True},
    {"sku": "com.showdown.pack_ladder_ancient_history", "name": "Ancient History", "desc": "300 ancient history questions for The Ladder", "price": "2.49", "enabled": False},
]

# Obsolete SKUs to delete on next run. Add product IDs here when a pack is removed
# from the PRODUCTS list above — the script will remove them from Google Play.
OBSOLETE_SKUS: list[str] = []

# ── Main logic ────────────────────────────────────────────────────────────────

def get_service():
    if not KEY_FILE.exists():
        print(f"ERROR: Key file not found at {KEY_FILE}")
        sys.exit(1)
    creds = service_account.Credentials.from_service_account_file(str(KEY_FILE), scopes=SCOPES)
    return build('androidpublisher', 'v3', credentials=creds)

def split_price(price_str):
    units = str(int(float(price_str)))
    nanos = int((float(price_str) - int(float(price_str))) * 1000000000)
    return units, nanos

def create_or_update_iap(service, product):
    sku = product["sku"]
    units, nanos = split_price(product["price"])
    status_label = "ACTIVE" if product["enabled"] else "FUTURE"
    
    body = {
        "productId": sku,
        "listings": [
            {
                "languageCode": "en-US",
                "title": product["name"],
                "description": product["desc"]
            }
        ],
        "purchaseOptions": [
            {
                "purchaseOptionId": f"buy-{sku.replace('.', '-').replace('_', '-')}",
                "state": "ACTIVE",
                "buyOption": {
                    "legacyCompatible": True
                },
                "newRegionsConfig": {
                    "usdPrice": {
                        "currencyCode": "USD",
                        "units": units,
                        "nanos": nanos
                    },
                    "eurPrice": {
                        "currencyCode": "EUR",
                        "units": units,
                        "nanos": nanos
                    },
                    "availability": "AVAILABLE"
                },
                "taxAndComplianceSettings": {
                    "withdrawalRightType": "WITHDRAWAL_RIGHT_DIGITAL_CONTENT"
                }
            }
        ]
    }

    try:
        # 1. Check if exists
        try:
            service.monetization().onetimeproducts().get(packageName=PACKAGE_NAME, productId=sku).execute()
            
            # 2. If exists, ONLY update listings to avoid 'Cannot remove currency' error
            print(f"[{status_label}] {sku}...")
            service.monetization().onetimeproducts().patch(
                packageName=PACKAGE_NAME, 
                productId=sku, 
                body={"productId": sku, "listings": body["listings"]}, 
                updateMask="listings",
                regionsVersion_version=REGIONS_VERSION
            ).execute()
            print(f"  [UPDATED Metadata]")
            return "updated"
            
        except HttpError as e:
            if e.resp.status == 404:
                # 3. Create if missing
                print(f"[{status_label}] {sku}...")
                service.monetization().onetimeproducts().patch(
                    packageName=PACKAGE_NAME, 
                    productId=sku, 
                    body=body, 
                    updateMask="listings,purchaseOptions",
                    regionsVersion_version=REGIONS_VERSION,
                    allowMissing=True
                ).execute()
                print(f"  [CREATED New]")
                return "created"
            else:
                raise e
                
    except HttpError as e:
        print(f"  [ERROR] {e}")
        return "failed"

def delete_obsolete(service):
    """Delete one-time products whose SKUs are in OBSOLETE_SKUS. Used for IP cleanup."""
    if not OBSOLETE_SKUS:
        return 0, 0
    deleted, missing = 0, 0
    for sku in OBSOLETE_SKUS:
        try:
            service.monetization().onetimeproducts().delete(
                packageName=PACKAGE_NAME,
                productId=sku
            ).execute()
            print(f"[DELETE] {sku} — removed")
            deleted += 1
        except HttpError as e:
            if e.resp.status == 404:
                print(f"[DELETE] {sku} — not found, skip")
                missing += 1
            else:
                print(f"[DELETE] {sku} — FAILED: {e}")
        time.sleep(0.3)
    return deleted, missing

def main():
    print("=== ShowDown Google Play Monetization API Creator ===\n")
    service = get_service()

    # Delete obsolete first
    deleted, missing = delete_obsolete(service)
    if deleted or missing:
        print(f"\n  Removed: {deleted}, not present: {missing}\n")

    stats = {"created": 0, "updated": 0, "failed": 0}

    for product in PRODUCTS:
        result = create_or_update_iap(service, product)
        stats[result] += 1
        time.sleep(0.3) # Avoid rate limits

    print(f"\n=== Done: {stats['created']} created, {stats['updated']} updated, {stats['failed']} failed, {deleted} obsolete removed ===")

if __name__ == "__main__":
    main()
