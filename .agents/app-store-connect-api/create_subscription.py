#!/usr/bin/env python3
"""
Creates the ShowDown Premium auto-renewable subscriptions via App Store Connect API.
Run from anywhere: python3 .agents/app-store-connect-api/create_subscription.py
Key file: AuthKey_TYBAQ9XDGV.p8 at repo root (gitignored via *.p8).

Apple models monthly/annual as TWO product ids inside ONE subscription group
(Google, by contrast, uses one product id with two base plans — see the
google-play-iap sibling script). Mirrors src/data/store/subscription.ts.

NOTE: a subscription still needs a review screenshot before it can be submitted;
that is uploaded once from a dev build and is NOT done here.
"""

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

GROUP_REFERENCE_NAME = "Showdown Premium"
GROUP_LOCALIZATIONS = [
    {"locale": "en-US", "name": "Showdown Premium"},
    {"locale": "pl", "name": "Showdown Premium"},
]

# subscriptionPeriod ∈ {ONE_WEEK, ONE_MONTH, TWO_MONTHS, THREE_MONTHS, SIX_MONTHS, ONE_YEAR}
SUBSCRIPTIONS = [
    {
        "productId": "com.showdown.premium_monthly",
        "name": "Premium Monthly",
        "period": "ONE_MONTH",
        "price": "3.99",
        "desc": "Unlimited offline play, 15 daily challenges, and the Aurora theme.",
    },
    {
        "productId": "com.showdown.premium_annual",
        "name": "Premium Annual",
        "period": "ONE_YEAR",
        "price": "19.99",
        "desc": "A year of unlimited play, 15 daily challenges, and the Aurora theme.",
    },
]

# ── Auth ──────────────────────────────────────────────────────────────────────

def make_token():
    now = int(time.time())
    return jwt.encode(
        {"iss": ISSUER_ID, "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        KEY_FILE.read_text(),
        algorithm="ES256",
        headers={"kid": KEY_ID},
    )

def headers():
    return {"Authorization": f"Bearer {make_token()}", "Content-Type": "application/json"}

def get(path, params=None):
    r = requests.get(f"{BASE_URL}{path}", headers=headers(), params=params)
    r.raise_for_status()
    return r.json()

def post(path, body):
    return requests.post(f"{BASE_URL}{path}", headers=headers(), json=body)

# ── Logic ─────────────────────────────────────────────────────────────────────

def get_app_id():
    apps = get("/v1/apps", params={"filter[bundleId]": BUNDLE_ID}).get("data", [])
    if not apps:
        print(f"ERROR: No app found for bundle ID {BUNDLE_ID}")
        sys.exit(1)
    print(f"App ID: {apps[0]['id']}")
    return apps[0]["id"]

def ensure_group(app_id):
    body = {
        "data": {
            "type": "subscriptionGroups",
            "attributes": {"referenceName": GROUP_REFERENCE_NAME},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
        }
    }
    r = post("/v1/subscriptionGroups", body)
    if r.status_code in (200, 201):
        gid = r.json()["data"]["id"]
        print(f"Subscription group created (id={gid})")
        return gid
    if r.status_code == 409:
        groups = get(f"/v1/apps/{app_id}/subscriptionGroups").get("data", [])
        for g in groups:
            if g["attributes"].get("referenceName") == GROUP_REFERENCE_NAME:
                print(f"Subscription group already exists (id={g['id']})")
                return g["id"]
    print(f"ERROR creating subscription group: {r.status_code} {r.text}")
    sys.exit(1)

def add_group_localizations(group_id):
    for loc in GROUP_LOCALIZATIONS:
        body = {
            "data": {
                "type": "subscriptionGroupLocalizations",
                "attributes": {"name": loc["name"], "locale": loc["locale"]},
                "relationships": {
                    "subscriptionGroup": {"data": {"type": "subscriptionGroups", "id": group_id}}
                },
            }
        }
        r = post("/v1/subscriptionGroupLocalizations", body)
        if r.status_code in (200, 201):
            print(f"  group localization {loc['locale']} added")
        elif r.status_code == 409:
            print(f"  group localization {loc['locale']} already exists")
        else:
            print(f"  ERROR group localization {loc['locale']}: {r.status_code} {r.text}")

def ensure_subscription(group_id, sub):
    body = {
        "data": {
            "type": "subscriptions",
            "attributes": {
                "name": sub["name"],
                "productId": sub["productId"],
                "subscriptionPeriod": sub["period"],
                "familySharable": False,
                "groupLevel": 1,
                "reviewNote": "",
            },
            "relationships": {
                "group": {"data": {"type": "subscriptionGroups", "id": group_id}}
            },
        }
    }
    r = post("/v1/subscriptions", body)
    if r.status_code in (200, 201):
        sid = r.json()["data"]["id"]
        print(f"  created (id={sid})")
        return sid
    if r.status_code == 409:
        subs = get(f"/v1/subscriptionGroups/{group_id}/subscriptions").get("data", [])
        for s in subs:
            if s["attributes"].get("productId") == sub["productId"]:
                print(f"  already exists (id={s['id']})")
                return s["id"]
    print(f"  ERROR creating subscription: {r.status_code} {r.text}")
    return None

def add_localization(sub_id, sub):
    body = {
        "data": {
            "type": "subscriptionLocalizations",
            "attributes": {"name": sub["name"], "locale": "en-US", "description": sub["desc"]},
            "relationships": {
                "subscription": {"data": {"type": "subscriptions", "id": sub_id}}
            },
        }
    }
    r = post("/v1/subscriptionLocalizations", body)
    if r.status_code in (200, 201):
        print(f"  localization added")
    elif r.status_code == 409:
        print(f"  localization already exists")
    else:
        print(f"  ERROR localization: {r.status_code} {r.text}")

def set_price(sub_id, sub):
    target = sub["price"]
    pp_resp = get(f"/v1/subscriptions/{sub_id}/pricePoints",
                  params={"filter[territory]": "USA", "limit": 200})
    match = None
    for pp in pp_resp.get("data", []):
        cp = pp["attributes"].get("customerPrice", "")
        try:
            if abs(float(cp) - float(target)) < 0.001:
                match = pp
                break
        except (ValueError, TypeError):
            pass
    if not match:
        print(f"  ERROR: no price point found for ${target} in USA")
        return

    body = {
        "data": {
            "type": "subscriptionPrices",
            "attributes": {"startDate": None, "preserveCurrentPrice": False},
            "relationships": {
                "subscription": {"data": {"type": "subscriptions", "id": sub_id}},
                "subscriptionPricePoint": {
                    "data": {"type": "subscriptionPricePoints", "id": match["id"]}
                },
            },
        }
    }
    r = post("/v1/subscriptionPrices", body)
    if r.status_code in (200, 201):
        print(f"  price set to ${target}")
    elif r.status_code == 409:
        print(f"  price already set")
    else:
        print(f"  ERROR price: {r.status_code} {r.text}")

def main():
    print("=== ShowDown Premium Subscription Creator (App Store Connect) ===\n")
    app_id = get_app_id()
    group_id = ensure_group(app_id)
    add_group_localizations(group_id)
    print()

    ok, failed = 0, 0
    for sub in SUBSCRIPTIONS:
        print(f"[{sub['period']}] {sub['name']} ({sub['productId']}) ${sub['price']}")
        sid = ensure_subscription(group_id, sub)
        if not sid:
            failed += 1
            continue
        add_localization(sid, sub)
        set_price(sid, sub)
        ok += 1
        print()

    print(f"\n=== Done: {ok} ok, {failed} failed ===")
    print("Reminder: upload a subscription review screenshot from a dev build before submitting.")

if __name__ == "__main__":
    main()
