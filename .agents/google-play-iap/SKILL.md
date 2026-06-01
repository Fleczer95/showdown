---
name: google-play-iap
description: 'Google Play Developer API specialist for ShowDown. Covers the new Monetization API (v3), service account authentication, regional pricing (USD/EUR requirements), and mass IAP creation. Includes the create_iap.py script for automated product setup. Use when: Google Play Console, IAP management, Android billing, adding products, Play Store API, monetization setup.'
source: showdown (custom)
---

# Google Play Developer API — ShowDown

## Credentials

| Field           | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Service Account | `[SERVICE_ACCOUNT_EMAIL]` (grant it access to the ShowDown app in Play Console)     |
| Project ID      | `[PROJECT_ID]`                                       |
| Key file        | `google-play-key.json` — repo root, covered by `.gitignore` |
| Package Name    | `com.showdown.app`                                         |

## Initial Setup (Manual)

Google Play's permission system is strict and requires specific manual steps in the [Google Play Console](https://play.google.com/console/):

1.  **Enable API:** Enable the "Google Play Android Developer API" in the Google Cloud Console for project `[PROJECT_ID]`.
2.  **Invite User:** Go to **Users and permissions** → **Invite new users**. Add the service account email above.
3.  **App Permissions:** In the **App permissions** tab for ShowDown, ensure these are checked:
    - **Manage in-app products**
    - **Manage orders and subscriptions**
    - **View financial data, orders, and cancellation survey responses** (Required for the new Monetization API).
4.  **Accept TOS:** Check for any pending "Terms of Service" banners on the Console Home page.
5.  **Initialize API:** Create and **Activate** at least one IAP manually in the Console to "unlock" the API for that app.

## API Usage — New Monetization API (v3)

ShowDown has been migrated to the **new Monetization API**. Do NOT use the legacy `inappproducts` resource; it will return `403: Please migrate to the new publishing API`.

### Key Differences

| Feature        | Legacy API (`inappproducts`) | New API (`monetization`)                          |
| -------------- | ---------------------------- | ------------------------------------------------- |
| **Resource**   | `service.inappproducts()`    | `service.monetization().onetimeproducts()`        |
| **Methods**    | `insert`, `update`           | `patch` (acts as upsert with `allowMissing=True`) |
| **Price**      | `defaultPrice` object        | `newRegionsConfig` with `usdPrice` AND `eurPrice` |
| **Versioning** | None                         | Requires `regionsVersion.version` query parameter |

### Upsert Logic (Python)

**Important:** In the Python SDK, dotted query parameters like `regionsVersion.version` map to underscores (`regionsVersion_version`).

```python
params = {
    'packageName': 'com.showdown.app',
    'productId': 'com.showdown.pack_id',
    'updateMask': 'listings,purchaseOptions',
    'regionsVersion_version': '2025/03', # Required version string
    'allowMissing': True,                 # Set to True for creation
    'body': {
        'productId': 'com.showdown.pack_id',
        'listings': [{'languageCode': 'en-US', 'title': 'Name', 'description': 'Desc'}],
        'purchaseOptions': [{
            'purchaseOptionId': 'buy-id',
            'state': 'ACTIVE',
            'buyOption': {'legacyCompatible': True},
            'newRegionsConfig': {
                'usdPrice': {'currencyCode': 'USD', 'units': '1', 'nanos': 990000000},
                'eurPrice': {'currencyCode': 'EUR', 'units': '1', 'nanos': 990000000},
                'availability': 'AVAILABLE'
            }
        }]
    }
}
service.monetization().onetimeproducts().patch(**params).execute()
```

## How to Test Connectivity

Use this one-liner to verify permissions before running scripts:

```bash
python3 -c "
from google.oauth2 import service_account
from googleapiclient.discovery import build
creds = service_account.Credentials.from_service_account_file('google-play-key.json', scopes=['https://www.googleapis.com/auth/androidpublisher'])
service = build('androidpublisher', 'v3', credentials=creds)
result = service.reviews().list(packageName='com.showdown.app').execute()
print('Connection OK! Found', len(result.get('reviews', [])), 'reviews.')
"
```

## Bulk IAP Script

**File:** `create_iap.py` (this skill's directory)
**Run from repo root:** `python3 .agents/google-play-iap/create_iap.py`

The script handles:

- **Automatic Upsert:** Creates missing products or updates existing ones.
- **Safety Mask:** If a product already exists, it only updates `listings` (metadata) to avoid "Cannot remove currency" errors on pricing.
- **Dual Pricing:** Automatically sets both USD and EUR prices as required by the new API.
- **Rate Limiting:** Includes small delays to prevent Google API quota issues.

## Common Pitfalls

| Error                                           | Fix                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `403: Please migrate to the new publishing API` | Stop using `inappproducts`. Use `monetization().onetimeproducts()`.                                                                                                |
| `400: Regions Version must be specified`        | Pass `regionsVersion_version="2025/03"` as a parameter to the `patch` call.                                                                                        |
| `400: price in EUR is not set`                  | You must provide both `usdPrice` and `eurPrice` in `newRegionsConfig` for new products.                                                                            |
| `400: Cannot remove currency... EUR`            | Once a currency is added to a product, you cannot `patch` it away. If updating existing products, update `listings` only or include the full existing price array. |
| `403: The caller does not have permission`      | Ensure **"View financial data"** is checked in App Permissions.                                                                                                    |
