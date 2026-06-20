import { Platform } from 'react-native';
import {
    resolveSubscriptionPrice,
    resolveGoogleOfferToken,
    SUBSCRIPTION_PLANS,
    GOOGLE_SUBSCRIPTION_ID,
    type StoreProductLike,
} from './subscription';

const monthly = SUBSCRIPTION_PLANS.find((p) => p.id === 'monthly')!;
const annual = SUBSCRIPTION_PLANS.find((p) => p.id === 'annual')!;

describe('resolveSubscriptionPrice', () => {
    const originalOS = Platform.OS;
    afterEach(() => {
        (Platform as { OS: string }).OS = originalOS;
    });

    describe('iOS — one product per plan, price on displayPrice', () => {
        beforeEach(() => {
            (Platform as { OS: string }).OS = 'ios';
        });

        const products: StoreProductLike[] = [
            { id: monthly.appleSku, displayPrice: '$3.99' },
            { id: annual.appleSku, displayPrice: '$19.99' },
        ];

        it('reads the matching per-plan product price', () => {
            expect(resolveSubscriptionPrice(monthly, products)).toBe('$3.99');
            expect(resolveSubscriptionPrice(annual, products)).toBe('$19.99');
        });

        it('is undefined until the product loads', () => {
            expect(resolveSubscriptionPrice(monthly, [])).toBeUndefined();
        });
    });

    describe('Android — one shared product, price per base plan', () => {
        beforeEach(() => {
            (Platform as { OS: string }).OS = 'android';
        });

        const product: StoreProductLike = {
            id: GOOGLE_SUBSCRIPTION_ID,
            subscriptionOfferDetailsAndroid: [
                { basePlanId: 'monthly', pricingPhases: { pricingPhaseList: [{ formattedPrice: 'PLN 15.99' }] } },
                { basePlanId: 'yearly', pricingPhases: { pricingPhaseList: [{ formattedPrice: 'PLN 149.99' }] } },
            ],
        };

        it('resolves each base plan price off the single subscription product', () => {
            expect(resolveSubscriptionPrice(monthly, [product])).toBe('PLN 15.99');
            expect(resolveSubscriptionPrice(annual, [product])).toBe('PLN 149.99');
        });

        it('uses the standard recurring phase (last), past any trial/intro phase', () => {
            const withTrial: StoreProductLike = {
                id: GOOGLE_SUBSCRIPTION_ID,
                subscriptionOfferDetailsAndroid: [
                    {
                        basePlanId: 'monthly',
                        pricingPhases: {
                            pricingPhaseList: [{ formattedPrice: 'Free' }, { formattedPrice: 'PLN 15.99' }],
                        },
                    },
                ],
            };
            expect(resolveSubscriptionPrice(monthly, [withTrial])).toBe('PLN 15.99');
        });

        it('is undefined when the product or the base plan is missing', () => {
            expect(resolveSubscriptionPrice(monthly, [])).toBeUndefined();
            const monthlyOnly: StoreProductLike = {
                id: GOOGLE_SUBSCRIPTION_ID,
                subscriptionOfferDetailsAndroid: [
                    { basePlanId: 'monthly', pricingPhases: { pricingPhaseList: [{ formattedPrice: 'PLN 15.99' }] } },
                ],
            };
            expect(resolveSubscriptionPrice(annual, [monthlyOnly])).toBeUndefined();
        });
    });
});

describe('resolveGoogleOfferToken — Android offer token needed to launch a purchase', () => {
    const product: StoreProductLike = {
        id: GOOGLE_SUBSCRIPTION_ID,
        subscriptionOfferDetailsAndroid: [
            { basePlanId: 'monthly', offerToken: 'token-monthly', pricingPhases: { pricingPhaseList: [] } },
            { basePlanId: 'yearly', offerToken: 'token-annual', pricingPhases: { pricingPhaseList: [] } },
        ],
    };

    it('returns the matching base plan token', () => {
        expect(resolveGoogleOfferToken(monthly, [product])).toBe('token-monthly');
        expect(resolveGoogleOfferToken(annual, [product])).toBe('token-annual');
    });

    it('is undefined when the chosen base plan is not matched — never bills another plan', () => {
        const monthlyOnly: StoreProductLike = {
            id: GOOGLE_SUBSCRIPTION_ID,
            subscriptionOfferDetailsAndroid: [
                { basePlanId: 'monthly', offerToken: 'token-monthly', pricingPhases: { pricingPhaseList: [] } },
            ],
        };
        expect(resolveGoogleOfferToken(annual, [monthlyOnly])).toBeUndefined();
    });

    it('is undefined until the subs product loads — the silent-reject guard', () => {
        expect(resolveGoogleOfferToken(monthly, [])).toBeUndefined();
    });
});
