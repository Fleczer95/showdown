#!/usr/bin/env python3
"""
Creates the ShowDown Premium subscription via Google Play Monetization API (v3).
Run from anywhere: python3 .agents/google-play-iap/create_subscription.py
Key file: google-play-key.json at repo root (gitignored).

Google models the subscription as ONE product id with TWO base plans
(monthly P1M + annual P1Y). Apple, by contrast, uses two product ids in one
group — see the app-store-connect-api sibling script. Mirrors
src/data/store/subscription.ts (GOOGLE_SUBSCRIPTION_ID + base plan ids).

Base plans are created in DRAFT then activated (the API forbids creating one
already ACTIVE). Re-runnable: existing base plans are left as-is.
"""

import sys
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

PRODUCT_ID = "com.showdown.premium"
LISTING = {
    "languageCode": "en-US",
    "title": "Showdown Premium",
    "description": "Unlimited offline play, 10 extra daily friend challenges, and the exclusive Aurora theme.",
}

# basePlanId mirrors SUBSCRIPTION_PLANS[].googleBasePlanId in subscription.ts.
BASE_PLANS = [
    {"basePlanId": "monthly", "period": "P1M", "price": "3.99"},
    {"basePlanId": "yearly", "period": "P1Y", "price": "34.99"},
]

def split_price(price_str):
    units = str(int(float(price_str)))
    nanos = int(round((float(price_str) - int(float(price_str))) * 1_000_000_000))
    return units, nanos

def base_plan_body(plan):
    units, nanos = split_price(plan["price"])
    usd = {"currencyCode": "USD", "units": units, "nanos": nanos}
    eur = {"currencyCode": "EUR", "units": units, "nanos": nanos}
    return {
        "basePlanId": plan["basePlanId"],
        "autoRenewingBasePlanType": {
            "billingPeriodDuration": plan["period"],
            "gracePeriodDuration": "P30D",
            "resubscribeState": "RESUBSCRIBE_STATE_ACTIVE",
            # At most one base plan may be legacy-compatible (pre-v5 Play Billing).
            "legacyCompatible": plan["basePlanId"] == "monthly",
        },
        "regionalConfigs": [
            {"regionCode": "US", "newSubscriberAvailability": True, "price": usd},
        ],
        "otherRegionsConfig": {
            "usdPrice": usd,
            "eurPrice": eur,
            "newSubscriberAvailability": True,
        },
    }

def get_service():
    if not KEY_FILE.exists():
        print(f"ERROR: Key file not found at {KEY_FILE}")
        sys.exit(1)
    creds = service_account.Credentials.from_service_account_file(str(KEY_FILE), scopes=SCOPES)
    return build('androidpublisher', 'v3', credentials=creds)

def upsert_subscription(service):
    body = {
        "productId": PRODUCT_ID,
        "listings": [LISTING],
        "basePlans": [base_plan_body(p) for p in BASE_PLANS],
    }
    try:
        service.monetization().subscriptions().get(
            packageName=PACKAGE_NAME, productId=PRODUCT_ID
        ).execute()
        print(f"[UPDATE] {PRODUCT_ID} — updating listings only (base plan prices are immutable once set)")
        service.monetization().subscriptions().patch(
            packageName=PACKAGE_NAME,
            productId=PRODUCT_ID,
            body={"productId": PRODUCT_ID, "listings": [LISTING]},
            updateMask="listings",
            regionsVersion_version=REGIONS_VERSION,
        ).execute()
    except HttpError as e:
        if e.resp.status == 404:
            print(f"[CREATE] {PRODUCT_ID} — creating subscription with {len(BASE_PLANS)} base plans")
            service.monetization().subscriptions().patch(
                packageName=PACKAGE_NAME,
                productId=PRODUCT_ID,
                body=body,
                updateMask="listings,basePlans",
                regionsVersion_version=REGIONS_VERSION,
                allowMissing=True,
            ).execute()
        else:
            raise

def activate_base_plans(service):
    for plan in BASE_PLANS:
        bid = plan["basePlanId"]
        try:
            service.monetization().subscriptions().basePlans().activate(
                packageName=PACKAGE_NAME,
                productId=PRODUCT_ID,
                basePlanId=bid,
                body={"packageName": PACKAGE_NAME, "productId": PRODUCT_ID, "basePlanId": bid},
            ).execute()
            print(f"  base plan '{bid}' ACTIVE")
        except HttpError as e:
            # Already active / not yet propagated — surface but don't abort the run.
            print(f"  base plan '{bid}' activate note: {e}")
        time.sleep(0.3)

def main():
    print("=== ShowDown Premium Subscription Creator (Google Play) ===\n")
    service = get_service()
    upsert_subscription(service)
    time.sleep(0.5)
    activate_base_plans(service)
    print("\n=== Done ===")

if __name__ == "__main__":
    main()
