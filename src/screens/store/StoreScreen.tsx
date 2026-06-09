import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronLeft, History } from 'lucide-react-native';
import SafeContainer from '../../responsive/SafeContainer';
import Text from '../../components/atoms/Text';
import Spacer from '../../components/atoms/Spacer';
import Icon from '../../components/atoms/Icon';
import BottomSheet from '../../components/molecules/BottomSheet';
import Pressable from '../../components/atoms/HapticPressable';
import ActivityIndicator from '../../components/atoms/ActivityIndicator';
import Button from '../../components/molecules/Button';
import IconButton from '../../components/molecules/IconButton';
import { useResponsive } from '../../responsive/useResponsive';
import { useTheme } from '../../theme';
import { useTranslation } from '../../i18n/TranslationContext';
import { STORE_CATEGORIES, STORE_ICONS, type StoreCategory } from '../../data/store';
import type { CatalogEntry, PackDefinition } from '../../data/store/types';
import { useStore } from '../../hooks/store/useStore';
import { useResolvedStoreEntries } from '../../hooks/store/useStoreCatalog';
import type { RootStackParamList } from '../../navigation/types';
import { ThemePreview } from './ThemePreview';

type StoreScreenProps = NativeStackScreenProps<RootStackParamList, 'Store'>;

function getContrastColor(hexColor: string): string {
    const color = hexColor.replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#000000' : '#FFFFFF';
}

function StoreItemCard({
    entry,
    unlocked,
    price,
    onPress,
}: {
    entry: CatalogEntry;
    unlocked: boolean;
    price: string;
    onPress: (entry: CatalogEntry) => void;
}) {
    const theme = useTheme();
    const { t } = useTranslation();
    const { iconSize } = useResponsive();
    const IconComponent = STORE_ICONS[entry.presentation.iconName] ?? STORE_ICONS.themes;
    const accent = entry.presentation.accentColor;

    return (
        <Pressable onPress={() => onPress(entry)} haptic='light' style={styles.cardPressable}>
            <View
                pointerEvents='none'
                style={[
                    styles.card,
                    {
                        backgroundColor: accent + '10',
                        borderColor: accent + '30',
                        borderRadius: theme.radii.lg,
                        padding: theme.spacing.lg,
                    },
                ]}
            >
                <Icon
                    name={IconComponent}
                    size={iconSize(26)}
                    color={accent}
                    backgroundColor={accent + '18'}
                    borderRadius={theme.radii.md}
                    padding={theme.spacing.md}
                    containerStyle={{ marginRight: theme.spacing.md }}
                />
                <View style={styles.cardContent}>
                    <Text variant='body' weight='bold' numberOfLines={1}>
                        {t(entry.presentation.titleKey)}
                    </Text>
                    <Text variant='caption' color={theme.colors.textSecondary} numberOfLines={2}>
                        {t(entry.presentation.descriptionKey)}
                    </Text>
                </View>
                <View
                    style={[
                        styles.badge,
                        { backgroundColor: unlocked ? theme.colors.success + '15' : accent + '18' },
                    ]}
                >
                    <Text variant='caption' weight='bold' color={unlocked ? theme.colors.success : accent}>
                        {unlocked ? t('screen.store.unlocked') : price}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

export default function StoreScreen() {
    const theme = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation<StoreScreenProps['navigation']>();
    const route = useRoute<StoreScreenProps['route']>();
    const { scale, iconSize, tabletColumn } = useResponsive();
    const { purchaseItem, restorePurchases, isProcessing, priceBySku } = useStore();
    const resolvedEntries = useResolvedStoreEntries();
    const sectionListRef = useRef<SectionList<CatalogEntry>>(null);
    const [selectedCategory, setSelectedCategory] = useState<StoreCategory>('themes');
    const [detailItem, setDetailItem] = useState<CatalogEntry | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreMessageVisible, setRestoreMessageVisible] = useState(false);

    const ownedById = useMemo(
        () => new Map(resolvedEntries.map((resolved) => [resolved.entry.id, resolved.isPlayable])),
        [resolvedEntries],
    );

    useEffect(() => {
        if (route.params?.gameId === 'themes') {
            setSelectedCategory('themes');
        } else if (route.params?.gameId) {
            setSelectedCategory('packs');
        }
    }, [route.params?.gameId]);

    const resolvePrice = (entry: CatalogEntry): string =>
        (entry.sku ? priceBySku[entry.sku] : undefined) ?? entry.presentation.fallbackPrice ?? '';

    const sections = useMemo(() => {
        const forSale = resolvedEntries.map((resolved) => resolved.entry).filter((entry) => entry.tier === 'premium');

        if (selectedCategory === 'packs') {
            const packs = forSale.filter((entry): entry is PackDefinition => entry.kind === 'pack');
            const grouped = new Map<string, CatalogEntry[]>();
            packs.forEach((entry) => {
                grouped.set(entry.gameId, [...(grouped.get(entry.gameId) ?? []), entry]);
            });
            return Array.from(grouped.entries()).map(([gameId, data]) => ({
                gameId,
                title: t(`game.${gameId}.name`),
                data,
            }));
        }

        return [
            {
                gameId: 'themes',
                title: t('screen.store.category.themes'),
                data: forSale.filter((entry) => entry.kind === 'theme'),
            },
        ];
    }, [resolvedEntries, selectedCategory, t]);

    useEffect(() => {
        if (!route.params?.gameId || sections.length === 0) return;
        const sectionIndex = sections.findIndex((section) => section.gameId === route.params?.gameId);
        if (sectionIndex === -1) return;

        const timer = setTimeout(() => {
            sectionListRef.current?.scrollToLocation({
                sectionIndex,
                itemIndex: 0,
                animated: true,
                viewOffset: Platform.OS === 'ios' ? 0 : 20,
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [route.params?.gameId, sections]);

    const handlePurchase = async () => {
        if (!detailItem) return;
        const success = await purchaseItem(detailItem.id);
        if (success) {
            setDetailItem(null);
        }
    };

    const handleRestore = async () => {
        setIsRestoring(true);
        const success = await restorePurchases();
        setIsRestoring(false);
        if (success) {
            setRestoreMessageVisible(true);
            setTimeout(() => setRestoreMessageVisible(false), 2500);
        }
    };

    const detailUnlocked = detailItem ? (ownedById.get(detailItem.id) ?? false) : false;

    return (
        <SafeContainer edges={['top', 'bottom']}>
            <View style={styles.container}>
                <View
                    style={[
                        styles.header,
                        tabletColumn,
                        { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
                    ]}
                >
                    <IconButton
                        icon={<ChevronLeft size={iconSize(24)} color={theme.colors.text} />}
                        onPress={() => navigation.goBack()}
                        accessibilityLabel={t('screen.store.back')}
                        size='md'
                    />
                    <Text variant='heading' weight='bold' style={styles.title}>
                        {t('screen.store.title')}
                    </Text>
                    <IconButton
                        icon={
                            isRestoring ? (
                                <ActivityIndicator size='sm' color={theme.colors.text} />
                            ) : (
                                <History size={iconSize(22)} color={theme.colors.text} />
                            )
                        }
                        onPress={handleRestore}
                        accessibilityLabel={t('screen.store.restore')}
                        size='md'
                        disabled={isRestoring}
                    />
                </View>

                <View style={[styles.categoriesContainer, tabletColumn]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                        {STORE_CATEGORIES.map((category) => {
                            const active = selectedCategory === category.id;
                            const CategoryIcon = category.icon;
                            return (
                                <Pressable
                                    key={category.id}
                                    onPress={() => setSelectedCategory(category.id)}
                                    haptic='light'
                                    style={[
                                        styles.tab,
                                        {
                                            borderRadius: theme.radii.lg,
                                            borderColor: active ? theme.colors.primary : theme.colors.border,
                                            backgroundColor: active ? theme.colors.primary + '12' : theme.colors.surface,
                                        },
                                    ]}
                                >
                                    <View pointerEvents='none' style={styles.tabContent}>
                                        <CategoryIcon
                                            size={iconSize(18)}
                                            color={active ? theme.colors.primary : theme.colors.textSecondary}
                                        />
                                        <Text
                                            variant='body'
                                            weight={active ? 'bold' : 'medium'}
                                            color={active ? theme.colors.primary : theme.colors.textSecondary}
                                        >
                                            {t(`screen.store.category.${category.id}`)}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                <SectionList
                    ref={sectionListRef}
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <StoreItemCard
                            entry={item}
                            unlocked={ownedById.get(item.id) ?? false}
                            price={resolvePrice(item)}
                            onPress={setDetailItem}
                        />
                    )}
                    renderSectionHeader={({ section }) =>
                        selectedCategory === 'packs' ? (
                            <Text
                                variant='caption'
                                weight='bold'
                                color={theme.colors.textMuted}
                                style={[styles.sectionHeader, { paddingTop: theme.spacing.md }]}
                            >
                                {section.title.toUpperCase()}
                            </Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={[styles.empty, { padding: theme.spacing.xl }]}>
                            <Text variant='body' color={theme.colors.textSecondary} align='center'>
                                {t('screen.store.empty')}
                            </Text>
                        </View>
                    }
                    contentContainerStyle={[
                        styles.listContent,
                        tabletColumn,
                        { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl },
                    ]}
                    stickySectionHeadersEnabled={false}
                    showsVerticalScrollIndicator={false}
                    onScrollToIndexFailed={() => undefined}
                />

                {restoreMessageVisible && (
                    <View
                        pointerEvents='none'
                        style={[
                            styles.toast,
                            {
                                backgroundColor: theme.colors.success,
                                borderRadius: theme.radii.md,
                                bottom: theme.spacing.xl,
                            },
                        ]}
                    >
                        <Text variant='body' weight='semibold' color={theme.colors.onPrimary} align='center'>
                            {t('screen.store.restore_success')}
                        </Text>
                    </View>
                )}
            </View>

            <BottomSheet scrollable visible={!!detailItem} onClose={() => !isProcessing && setDetailItem(null)}>
                {detailItem && (
                    <View style={[styles.detailContainer, { paddingBottom: theme.spacing.sm }]}>
                        <View style={styles.detailHeader}>
                            <View
                                style={[
                                    styles.detailIcon,
                                    {
                                        backgroundColor: detailItem.presentation.accentColor + '15',
                                        borderColor: detailItem.presentation.accentColor + '2E',
                                        width: scale(64, 80),
                                        height: scale(64, 80),
                                        borderRadius: scale(18, 22),
                                    },
                                ]}
                            >
                                {React.createElement(
                                    STORE_ICONS[detailItem.presentation.iconName] ?? STORE_ICONS.themes,
                                    {
                                        size: iconSize(32),
                                        color: detailItem.presentation.accentColor,
                                    },
                                )}
                            </View>

                            <View style={styles.detailHeaderText}>
                                <Text variant='heading' weight='bold'>
                                    {t(detailItem.presentation.titleKey)}
                                </Text>
                                <Spacer size='xs' />
                                <Text variant='body' color={theme.colors.textSecondary}>
                                    {t(detailItem.presentation.descriptionKey)}
                                </Text>
                            </View>
                        </View>

                        {detailItem.kind === 'theme' && (
                            <>
                                <Spacer size='lg' />
                                <ThemePreview tokens={detailItem.tokens} />
                            </>
                        )}

                        {detailItem.presentation.featuresKey?.length ? (
                            <View
                                style={[
                                    styles.featuresCard,
                                    {
                                        backgroundColor: detailItem.presentation.accentColor + '14',
                                        borderColor: detailItem.presentation.accentColor + '33',
                                    },
                                ]}
                            >
                                {detailItem.presentation.featuresKey.map((featureKey) => (
                                    <View key={featureKey} style={styles.featureRow}>
                                        <View
                                            style={[
                                                styles.featureDot,
                                                { backgroundColor: detailItem.presentation.accentColor },
                                            ]}
                                        />
                                        <Text
                                            variant='body'
                                            color={theme.colors.textSecondary}
                                            style={styles.featureText}
                                        >
                                            {t(featureKey)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        <Spacer size='xl' />

                        {detailUnlocked ? (
                            <View
                                style={[
                                    styles.purchasedNotice,
                                    {
                                        backgroundColor: theme.colors.success + '12',
                                        borderColor: theme.colors.success + '2E',
                                    },
                                ]}
                            >
                                <Check size={iconSize(20)} color={theme.colors.success} />
                                <Spacer size='sm' direction='horizontal' />
                                <Text variant='body' weight='bold' color={theme.colors.success}>
                                    {t('screen.store.unlocked')}
                                </Text>
                            </View>
                        ) : (
                            <View
                                style={[
                                    styles.buyButtonShadow,
                                    {
                                        borderRadius: theme.radii.full,
                                        backgroundColor: detailItem.presentation.accentColor,
                                        shadowColor: detailItem.presentation.accentColor,
                                    },
                                ]}
                            >
                                <Button
                                    variant='primary'
                                    size='lg'
                                    fullWidth
                                    onPress={handlePurchase}
                                    loading={isProcessing}
                                    style={{
                                        backgroundColor: detailItem.presentation.accentColor,
                                        borderColor: detailItem.presentation.accentColor,
                                    }}
                                    textColor={getContrastColor(detailItem.presentation.accentColor)}
                                >
                                    {t('screen.store.buy', { price: resolvePrice(detailItem) })}
                                </Button>
                            </View>
                        )}

                        <Spacer size='md' />

                        {!detailUnlocked && !isProcessing ? (
                            <Pressable onPress={() => setDetailItem(null)} haptic='light'>
                                <Text variant='body' color={theme.colors.textMuted} align='center'>
                                    {t('common.cancel')}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                )}
            </BottomSheet>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    categoriesContainer: {
        paddingBottom: 12,
    },
    tabs: {
        gap: 10,
        paddingHorizontal: 20,
    },
    tab: {
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    tabContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    listContent: {
        paddingTop: 8,
    },
    cardPressable: {
        marginBottom: 12,
    },
    card: {
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardContent: {
        flex: 1,
        gap: 4,
    },
    badge: {
        marginLeft: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    sectionHeader: {
        paddingBottom: 8,
        letterSpacing: 1.2,
    },
    empty: {
        alignItems: 'center',
    },
    toast: {
        position: 'absolute',
        left: 20,
        right: 20,
        padding: 14,
    },
    detailContainer: {
        alignItems: 'center',
        paddingTop: 8,
    },
    detailHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    detailHeaderText: {
        flex: 1,
    },
    detailIcon: {
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featuresCard: {
        width: '100%',
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 14,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureText: {
        flex: 1,
    },
    featureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 12,
    },
    purchasedNotice: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 9999,
        borderWidth: 1,
    },
    buyButtonShadow: {
        width: '100%',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
});
