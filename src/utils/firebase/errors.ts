import type { PurchaseErrorCategory } from './events';

const ERROR_CODE_TO_CATEGORY: Record<string, PurchaseErrorCategory> = {
    E_USER_CANCELLED: 'user_cancelled',
    E_USER_ERROR: 'user_cancelled',
    E_NETWORK_ERROR: 'network',
    E_SERVICE_ERROR: 'store_unavailable',
    E_NOT_PREPARED: 'store_unavailable',
    E_REMOTE_ERROR: 'store_unavailable',
    E_ALREADY_OWNED: 'already_owned',
    E_RECEIPT_FINISHED_FAILED: 'payment_invalid',
    E_DEVELOPER_ERROR: 'payment_invalid',
    E_DEFERRED_PAYMENT: 'payment_invalid',
    E_ITEM_UNAVAILABLE: 'store_unavailable',
    E_BILLING_RESPONSE_JSON_PARSE_ERROR: 'unknown',
    E_INTERRUPTED: 'unknown',
    E_IAP_NOT_AVAILABLE: 'store_unavailable',
};

export function mapErrorToCategory(errorCode?: string | null): PurchaseErrorCategory {
    if (!errorCode) return 'unknown';
    return ERROR_CODE_TO_CATEGORY[errorCode] ?? 'unknown';
}

export function safeErrorCode(error: unknown): string {
    if (!error) return 'unknown';
    if (typeof error === 'string') return error.slice(0, 64);
    if (typeof error === 'object' && error !== null) {
        const maybeCode = (error as { code?: unknown }).code;
        if (typeof maybeCode === 'string') return maybeCode.slice(0, 64);
    }
    return 'unknown';
}
