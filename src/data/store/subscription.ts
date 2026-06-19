import { Platform } from 'react-native';

/**
 * Premium subscription — a recurring, perks-only product that lives OUTSIDE
 * `STORE_CATALOG` on purpose. The catalog drives one-time packs/themes, the
 * per-item bonus math and the `type:'in-app'` SKU fetch; the subscription is
 * neither content nor a bonus source and is fetched separately with
 * `type:'subs'`, so keeping it apart stops it polluting any of that.
 *
 * Premium grants exactly three things, all gated by a single `isPremium`
 * boolean (see `useStore`): unlimited offline runs, a raised challenge cap, and
 * the subscriber-exclusive Aurora theme. It never unlocks any catalog item.
 *
 * Store modelling differs per platform (mirrored in `create_subscription.py`):
 *   - Apple: two product ids in one subscription group.
 *   - Google: one subscription product id with two base plans.
 */
export interface SubscriptionPlan {
    /** Stable internal id used by the UI and analytics. */
    id: 'monthly' | 'annual';
    /** Apple product id (one auto-renewable product per plan). */
    appleSku: string;
    /** Google base plan id under the single Google subscription product. */
    googleBasePlanId: string;
    /** Display-only price until the store query resolves (see `priceBySku`). */
    fallbackPrice: string;
    titleKey: string;
    /** "/mo" or "/yr" suffix key. */
    periodKey: string;
}

/** Single Google Play subscription product id; the plans are base plans under it. */
export const GOOGLE_SUBSCRIPTION_ID = 'com.showdown.premium';

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
    {
        id: 'monthly',
        appleSku: 'com.showdown.premium_monthly',
        googleBasePlanId: 'monthly',
        fallbackPrice: '$3.99',
        titleKey: 'screen.store.premium.plan.monthly',
        periodKey: 'screen.store.premium.period.month',
    },
    {
        id: 'annual',
        appleSku: 'com.showdown.premium_annual',
        googleBasePlanId: 'annual',
        fallbackPrice: '$19.99',
        titleKey: 'screen.store.premium.plan.annual',
        periodKey: 'screen.store.premium.period.year',
    },
];

/**
 * SKUs to query with `fetchProducts({ type: 'subs' })`. Apple exposes one
 * product id per plan; Google exposes a single product id (plans are base
 * plans), so the queried list differs per platform.
 */
export const SUBSCRIPTION_SKUS: string[] =
    Platform.OS === 'android'
        ? [GOOGLE_SUBSCRIPTION_ID]
        : SUBSCRIPTION_PLANS.map((plan) => plan.appleSku);

/**
 * Every product id that signals an active subscription in
 * `getAvailablePurchases()` — Apple's per-plan ids plus Google's product id.
 */
export const SUBSCRIPTION_PRODUCT_IDS: ReadonlySet<string> = new Set<string>([
    GOOGLE_SUBSCRIPTION_ID,
    ...SUBSCRIPTION_PLANS.map((plan) => plan.appleSku),
]);

/** Whether a store productId belongs to the Premium subscription. */
export function isSubscriptionProductId(productId: string): boolean {
    return SUBSCRIPTION_PRODUCT_IDS.has(productId);
}

/** The store SKU a plan resolves to on the current platform (for price lookup). */
export function skuForPlan(plan: SubscriptionPlan): string {
    return Platform.OS === 'android' ? GOOGLE_SUBSCRIPTION_ID : plan.appleSku;
}
