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
        appleSku: 'com.showdown.premium_yearly',
        googleBasePlanId: 'yearly',
        fallbackPrice: '$34.99',
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

/**
 * Minimal structural shape of a fetched store product needed to read a
 * subscription price — avoids coupling this module to react-native-iap types.
 * iOS exposes one product per plan with a `displayPrice`; Android exposes one
 * product whose per-base-plan prices live in `subscriptionOfferDetailsAndroid`.
 */
export interface StoreProductLike {
    id: string;
    displayPrice?: string | null;
    subscriptionOfferDetailsAndroid?:
        | {
              basePlanId: string;
              offerToken?: string;
              pricingPhases: { pricingPhaseList: { formattedPrice: string }[] };
          }[]
        | null;
}

/**
 * The Google base plan offer token required to launch this plan's purchase, or
 * `undefined` until the subs product loads or when the chosen base plan isn't
 * present. Android-only — iOS purchases by product id and needs no token. We
 * never substitute another plan's offer: doing so would launch checkout for a
 * plan the user didn't pick (billing mismatch). `undefined` lets the caller
 * fail fast instead.
 */
export function resolveGoogleOfferToken(
    plan: SubscriptionPlan,
    products: readonly StoreProductLike[],
): string | undefined {
    const product = products.find((p) => p.id === GOOGLE_SUBSCRIPTION_ID);
    const offers = product?.subscriptionOfferDetailsAndroid ?? [];
    const match = offers.find((o) => o.basePlanId === plan.googleBasePlanId);
    return match?.offerToken ?? undefined;
}

/**
 * The localized store price for a plan, or `undefined` until products load.
 *   - iOS: the matching per-plan product's `displayPrice`.
 *   - Android: the matching base plan's standard recurring price — the last
 *     pricing phase (any free-trial/intro phases precede it).
 */
export function resolveSubscriptionPrice(
    plan: SubscriptionPlan,
    products: readonly StoreProductLike[],
): string | undefined {
    if (Platform.OS === 'android') {
        const product = products.find((p) => p.id === GOOGLE_SUBSCRIPTION_ID);
        const offer = product?.subscriptionOfferDetailsAndroid?.find(
            (o) => o.basePlanId === plan.googleBasePlanId,
        );
        const phases = offer?.pricingPhases.pricingPhaseList ?? [];
        return phases[phases.length - 1]?.formattedPrice;
    }
    return products.find((p) => p.id === plan.appleSku)?.displayPrice ?? undefined;
}
