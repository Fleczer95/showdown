import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Crown, Infinity as InfinityIcon, Swords, Sparkles, Settings } from 'lucide-react-native';
import Text from '../../components/atoms/Text';
import Spacer from '../../components/atoms/Spacer';
import Pressable from '../../components/atoms/HapticPressable';
import Button from '../../components/molecules/Button';
import { useTheme } from '../../theme';
import { blend, getContrastColor } from '../../theme/colorUtils';
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
export function PremiumPlans({ tabletColumn }: { tabletColumn?: StyleProp<ViewStyle> }) {
    const theme = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { isPremium, subscribePremium, isProcessing, subscriptionPriceByPlanId } = useStore();
    const accent = theme.colors.primary;
    const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
    // Measured height of the floating CTA so the scroll content can clear it
    // (the footer floats over the scroll, mirroring the game-setup screen).
    const [footerHeight, setFooterHeight] = useState(0);

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
        <View style={[styles.root, tabletColumn]}>
            {/* Scrollable content — hero, perks, the plan picker (visible first),
                then the exclusive theme preview as the scroll reward at the bottom. */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingHorizontal: theme.spacing.xl,
                        // The floating CTA overlaps the scroll, so we pad by its
                        // measured height to let the last content (the theme
                        // preview) scroll fully clear of it.
                        paddingBottom: footerHeight + theme.spacing.lg,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
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

                {isPremium ? (
                    <>
                        <Spacer size='lg' />
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
                    </>
                ) : (
                    <>
                        <Spacer size='lg' />
                        {SUBSCRIPTION_PLANS.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                price={priceFor(plan)}
                                selected={selected === plan.id}
                                onPress={() => setSelected(plan.id)}
                            />
                        ))}
                    </>
                )}

                <Spacer size='lg' />
                <Text variant='caption' weight='bold' color={theme.colors.textMuted} style={styles.exclusiveLabel}>
                    {t('screen.store.premium.exclusiveTheme').toUpperCase()}
                </Text>
                <Spacer size='sm' />
                <View style={styles.previewWrap}>
                    <ThemePreview tokens={auroraTheme} />
                </View>
            </ScrollView>

            {/* Floating CTA — sits over the scroll (transparent, like the
                game-setup screen) so the theme preview stays visible underneath
                while scrolling. The bottom inset is absorbed here so the button
                clears the home indicator. One button that swaps by state:
                subscribe when not premium, manage the subscription when already
                subscribed. */}
            <View
                onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
                style={[
                    styles.footer,
                    {
                        paddingHorizontal: theme.spacing.xl,
                        paddingBottom: insets.bottom + theme.spacing.sm,
                    },
                ]}
            >
                {isPremium ? (
                    <Button
                        variant='primary'
                        size='lg'
                        fullWidth
                        onPress={() => Linking.openURL(MANAGE_URL)}
                        icon={<Settings size={20} color={accent} />}
                        style={{
                            backgroundColor: blend(accent, theme.colors.background, 0.22),
                            borderColor: accent,
                            borderWidth: 1.5,
                        }}
                        textColor={accent}
                    >
                        {t('screen.store.premium.manage')}
                    </Button>
                ) : (
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
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 8,
    },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 16,
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
