import React, { useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Store } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Pressable from '../components/atoms/HapticPressable';
import IconButton from '../components/molecules/IconButton';
import ThemeSwatch from '../components/molecules/ThemeSwatch';
import { useTheme, useThemeActions, themeRegistry } from '../theme';
import { useTranslation } from '../i18n';
import { useStore } from '../hooks/store/useStore';
import { useProgression } from '../hooks/useProgression';
import { LEVEL_MAP } from '../game/progression';
import { useResponsive } from '../responsive/useResponsive';

interface ThemeTile {
    value: string;
    label: string;
    tokens: any;
    isLocked: boolean;
    lockLabel?: string;
    isEarned?: boolean;
    rewardId?: string;
    isSubscriber?: boolean;
}

/** Splits a flat list of tiles into grid rows of `columns` each. */
function toRows(tiles: ThemeTile[], columns: number): ThemeTile[][] {
    const rows: ThemeTile[][] = [];
    for (let i = 0; i < tiles.length; i += columns) {
        rows.push(tiles.slice(i, i + columns));
    }
    return rows;
}

/**
 * Dedicated theme picker. Replaces the inline grid that used to live in
 * Settings so the catalogue can grow without burying every other setting.
 * Themes are grouped (Free / Premium / Earned) and rendered as live mini
 * previews; tapping one applies it instantly, while locked tiles route to the
 * Store or the Level Map.
 */
export function ThemeScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const theme = useTheme();
    const { themeId, setTheme } = useThemeActions();
    const { purchasedItemIds, isPremium } = useStore();
    const { unlockedRewards } = useProgression();
    const { breakpoint, iconSize } = useResponsive();

    const columns = breakpoint === 'expanded' ? 4 : 3;

    const sections = useMemo(() => {
        const free: ThemeTile[] = [];
        const premium: ThemeTile[] = [];
        const subscriber: ThemeTile[] = [];
        const earned: ThemeTile[] = [];

        themeRegistry.forEach((opt) => {
            const isLocked = opt.isSubscriber
                ? !isPremium
                : opt.isEarned
                  ? !unlockedRewards.has(opt.rewardId!)
                  : !!opt.isPremium && !purchasedItemIds.includes(`theme-${opt.value}`);
            const requiredLevel = opt.isEarned
                ? LEVEL_MAP.find((node) => node.rewardId === opt.rewardId)?.level
                : undefined;

            const tile: ThemeTile = {
                value: opt.value,
                label: t(opt.labelKey as any),
                tokens: opt.theme,
                isLocked,
                lockLabel:
                    isLocked && requiredLevel
                        ? t('progression.levelShort', { n: requiredLevel })
                        : undefined,
                isEarned: opt.isEarned,
                rewardId: opt.rewardId,
                isSubscriber: opt.isSubscriber,
            };

            if (opt.isSubscriber) subscriber.push(tile);
            else if (opt.isEarned) earned.push(tile);
            else if (opt.isPremium) premium.push(tile);
            else free.push(tile);
        });

        return [
            { key: 'free', title: t('screen.themePicker.sections.free'), tiles: free },
            { key: 'premium', title: t('screen.themePicker.sections.premium'), tiles: premium },
            { key: 'subscriber', title: t('screen.themePicker.sections.subscriber'), tiles: subscriber },
            { key: 'earned', title: t('screen.themePicker.sections.earned'), tiles: earned },
        ]
            .filter((section) => section.tiles.length > 0)
            .map((section) => ({ ...section, data: toRows(section.tiles, columns) }));
    }, [t, purchasedItemIds, isPremium, unlockedRewards, columns]);

    const handlePress = (tile: ThemeTile) => {
        if (tile.isLocked) {
            if (tile.isEarned) {
                navigation.navigate('Progress' as any, { focusRewardId: tile.rewardId });
            } else if (tile.isSubscriber) {
                navigation.navigate('Store' as any, { gameId: 'premium' });
            } else {
                navigation.navigate('Store' as any, { gameId: 'themes' });
            }
            return;
        }
        setTheme(tile.value);
    };

    return (
        <SafeContainer edges={['top', 'bottom']} enableLeftSwipe>
            <View
                style={[
                    styles.header,
                    { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
                ]}
            >
                <IconButton
                    icon={<ChevronLeft size={iconSize(24)} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('screen.settings.back')}
                />
                <Text variant='heading' weight='bold' style={styles.title}>
                    {t('screen.themePicker.title')}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(row, index) => row.map((tile) => tile.value).join('-') + index}
                stickySectionHeadersEnabled={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: theme.spacing.lg,
                    paddingBottom: theme.spacing.xxl,
                }}
                ListHeaderComponent={
                    <Text
                        variant='body'
                        color={theme.colors.textSecondary}
                        style={{ marginBottom: theme.spacing.md, paddingHorizontal: theme.spacing.sm }}
                    >
                        {t('screen.themePicker.subtitle')}
                    </Text>
                }
                renderSectionHeader={({ section }) => (
                    <Text
                        variant='caption'
                        weight='bold'
                        color={theme.colors.textSecondary}
                        style={[
                            styles.sectionLabel,
                            {
                                marginTop: theme.spacing.lg,
                                marginBottom: theme.spacing.sm,
                                paddingHorizontal: theme.spacing.sm,
                            },
                        ]}
                    >
                        {section.title}
                    </Text>
                )}
                renderItem={({ item: row }) => (
                    <View style={[styles.row, { gap: theme.spacing.md, marginBottom: theme.spacing.md }]}>
                        {row.map((tile) => (
                            // Cell owns the 1/N width; the swatch's Pressable stretches to fill it.
                            // (HapticPressable only applies flex to its inner view, so a bare
                            // <ThemeSwatch flex:1> inside a row collapses to content width.)
                            <View key={tile.value} style={styles.cell}>
                                <ThemeSwatch
                                    tokens={tile.tokens}
                                    label={tile.label}
                                    selected={tile.value === themeId}
                                    locked={tile.isLocked}
                                    lockLabel={tile.lockLabel}
                                    onPress={() => handlePress(tile)}
                                    testID={`theme-swatch-${tile.value}`}
                                />
                            </View>
                        ))}
                        {/* Keep the last partial row left-aligned. */}
                        {row.length < columns &&
                            Array.from({ length: columns - row.length }).map((_, i) => (
                                <View key={`spacer-${i}`} style={styles.spacer} />
                            ))}
                    </View>
                )}
                ListFooterComponent={
                    <Pressable
                        onPress={() => navigation.navigate('Store' as any, { gameId: 'themes' })}
                        haptic='light'
                        accessibilityRole='button'
                        accessibilityLabel={t('screen.themePicker.store')}
                        style={[
                            styles.storeRow,
                            {
                                marginTop: theme.spacing.lg,
                                padding: theme.spacing.lg,
                                borderRadius: theme.radii.lg,
                                borderColor: theme.colors.border,
                                backgroundColor: theme.colors.surface,
                            },
                        ]}
                    >
                        <View pointerEvents='none' style={styles.storeRowContent}>
                            <Store size={iconSize(20)} color={theme.colors.primary} />
                            <Text variant='body' weight='semibold' color={theme.colors.primary}>
                                {t('screen.themePicker.store')}
                            </Text>
                        </View>
                        <ChevronRight size={iconSize(20)} color={theme.colors.textMuted} />
                    </Pressable>
                }
            />
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    sectionLabel: {
        letterSpacing: 1.2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    cell: {
        flex: 1,
    },
    spacer: {
        flex: 1,
    },
    storeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: StyleSheet.hairlineWidth,
    },
    storeRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
});

export default ThemeScreen;
