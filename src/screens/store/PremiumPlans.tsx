import React, { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { Check, Crown, Infinity as InfinityIcon, Swords, Sparkles } from 'lucide-react-native';
import Text from '../../components/atoms/Text';
import Spacer from '../../components/atoms/Spacer';
import Pressable from '../../components/atoms/HapticPressable';
import Button from '../../components/molecules/Button';
import { useTheme } from '../../theme';
import { getContrastColor } from '../../theme/colorUtils';
import { useTranslation } from '../../i18n/TranslationContext';
import { useStore } from '../../hooks/store/useStore';
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '../../data/store/subscription';
import { auroraTheme } from '../../theme/themes';
import { ThemePreview } from './ThemePreview';

/** Where the OS lets the user manage / cancel an active subscription. */
const MANAGE_URL = Platform.select({
    ios: 'https://apps.apple.com/account/subscriptions',
    android: 'https://play.google.com/store/account/subscriptions',
    default: 'https://play.google.com/store/account/subscriptions',
}) as string;

const PERK_ICONS = [InfinityIcon, Swords, Sparkles];
const PERK_KEYS = [
    'screen.store.premium.perk.offline',
    'screen.store.premium.perk.challenges',
    'screen.store.premium.perk.theme',
];

function PerksList({ accent }: { accent: string }) {
    const theme = useTheme();
    const { t } = useTranslation();
    return (
        <View
            style={[
                styles.perks,
                { backgroundColor: accent + '12', borderColor: accent + '30', borderRadius: theme.radii.lg },
            ]}
        >
            {PERK_KEYS.map((key, i) => {
                const PerkIcon = PERK_ICONS[i];
                return (
                    <View key={key} style={styles.perkRow}>
                        <PerkIcon size={20} color={accent} />
                        <Text variant='body' color={theme.colors.textSecondary} style={styles.perkText}>
                            {t(key)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

function PlanCard({
    plan,
    price,
    selected,
    onPress,
}: {
    plan: SubscriptionPlan;
    price: string;
    selected: boolean;
    onPress: () => void;
}) {
    const theme = useTheme();
    const { t } = useTranslation();
    const accent = theme.colors.primary;
    const isAnnual = plan.id === 'annual';
    return (
        <Pressable onPress={onPress} haptic='light' style={styles.planPressable}>
            <View
                pointerEvents='none'
                style={[
                    styles.planCard,
                    {
                        borderRadius: theme.radii.lg,
                        borderColor: selected ? accent : theme.colors.border,
                        borderWidth: selected ? 2 : 1,
                        backgroundColor: selected ? accent + '10' : theme.colors.surface,
                    },
                ]}
            >
                <View style={styles.planText}>
                    <Text variant='body' weight='bold'>
                        {t(plan.titleKey)}
                    </Text>
                    <Text variant='caption' color={theme.colors.textSecondary}>
                        {`${price} ${t(plan.periodKey)}`}
                    </Text>
                </View>
                {isAnnual && (
                    <View style={[styles.saveBadge, { backgroundColor: theme.colors.success + '1F' }]}>
                        <Text variant='caption' weight='bold' color={theme.colors.success}>
                            {t('screen.store.premium.bestValue')}
                        </Text>
                    </View>
                )}
            </View>
        </Pressable>
    );
}

/** The Premium subscription tab — perks-only plus the subscriber-exclusive Aurora theme. */
export function PremiumPlans() {
    const theme = useTheme();
    const { t } = useTranslation();
    const { isPremium, subscribePremium, isProcessing, subscriptionPriceByPlanId } = useStore();
    const accent = theme.colors.primary;
    const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');

    const priceFor = (plan: SubscriptionPlan): string =>
        subscriptionPriceByPlanId[plan.id] ?? plan.fallbackPrice;

    const onSubscribe = async () => {
        // `false` means the purchase never launched (e.g. the store product
        // wasn't ready) — surface it. User cancellation flows through the IAP
        // error handler, not this return, so this won't fire on cancel.
        const launched = await subscribePremium(selected);
        if (!launched) {
            Alert.alert(t('screen.store.premium.errorTitle'), t('screen.store.premium.errorDesc'));
        }
    };

    return (
        <View style={[styles.container, { paddingHorizontal: theme.spacing.xl }]}>
            <View style={styles.hero}>
                <View
                    style={[
                        styles.crown,
                        { backgroundColor: accent + '18', borderRadius: theme.radii.xl, borderColor: accent + '33' },
                    ]}
                >
                    <Crown size={32} color={accent} />
                </View>
                <Spacer size='md' />
                <Text variant='heading' weight='bold' align='center'>
                    {t('screen.store.premium.title')}
                </Text>
                <Spacer size='xs' />
                <Text variant='body' color={theme.colors.textSecondary} align='center'>
                    {t('screen.store.premium.subtitle')}
                </Text>
            </View>

            <Spacer size='lg' />
            <PerksList accent={accent} />

            <Spacer size='lg' />
            <Text variant='caption' weight='bold' color={theme.colors.textMuted} style={styles.exclusiveLabel}>
                {t('screen.store.premium.exclusiveTheme').toUpperCase()}
            </Text>
            <Spacer size='sm' />
            <View style={styles.previewWrap}>
                <ThemePreview tokens={auroraTheme} />
            </View>

            <Spacer size='lg' />

            {isPremium ? (
                <View
                    style={[
                        styles.activeNotice,
                        { backgroundColor: theme.colors.success + '12', borderColor: theme.colors.success + '2E' },
                    ]}
                >
                    <Check size={20} color={theme.colors.success} />
                    <Spacer size='sm' direction='horizontal' />
                    <Text variant='body' weight='bold' color={theme.colors.success}>
                        {t('screen.store.premium.active')}
                    </Text>
                </View>
            ) : (
                <>
                    {SUBSCRIPTION_PLANS.map((plan) => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            price={priceFor(plan)}
                            selected={selected === plan.id}
                            onPress={() => setSelected(plan.id)}
                        />
                    ))}
                    <Spacer size='md' />
                    <Button
                        variant='primary'
                        size='lg'
                        fullWidth
                        onPress={onSubscribe}
                        loading={isProcessing}
                        style={{ backgroundColor: accent, borderColor: accent }}
                        textColor={getContrastColor(accent)}
                    >
                        {t('screen.store.premium.subscribe')}
                    </Button>
                </>
            )}

            <Spacer size='md' />
            <Pressable onPress={() => Linking.openURL(MANAGE_URL)} haptic='light'>
                <Text variant='caption' color={theme.colors.textMuted} align='center'>
                    {t('screen.store.premium.manage')}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 8,
        paddingBottom: 48,
    },
    hero: {
        alignItems: 'center',
    },
    crown: {
        width: 64,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    perks: {
        borderWidth: 1,
        padding: 16,
        gap: 14,
    },
    perkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    perkText: {
        flex: 1,
    },
    exclusiveLabel: {
        letterSpacing: 1.2,
    },
    previewWrap: {
        alignItems: 'center',
    },
    planPressable: {
        marginBottom: 10,
    },
    planCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    planText: {
        gap: 4,
    },
    saveBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    activeNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 9999,
        borderWidth: 1,
    },
});

export default PremiumPlans;
