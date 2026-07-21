import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, PackageCheck } from 'lucide-react-native';
import Icon from '../atoms/Icon';
import Stack from '../atoms/Stack';
import Text from '../atoms/Text';
import BottomSheet from './BottomSheet';
import Button from './Button';
import { getEntryForId } from '../../data/store/catalog';
import { useStore } from '../../hooks/store/useStore';
import { useTranslation } from '../../i18n/TranslationContext';
import { useTheme } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

const MAX_VISIBLE_ENTITLEMENTS = 4;

/** Shows exactly which entitlements a silent launch/foreground sync unlocked. */
function AutoSyncedPurchasesSheet() {
    const { autoSyncNotice, dismissAutoSyncNotice } = useStore();
    const { t } = useTranslation();
    const theme = useTheme();
    const { scale, iconSize } = useResponsive();

    const entitlements = useMemo(() => {
        if (!autoSyncNotice) return [];

        const items = autoSyncNotice.itemIds.flatMap((id) => {
            const entry = getEntryForId(id);
            return entry ? [{ id, label: t(entry.presentation.titleKey) as string }] : [];
        });

        if (autoSyncNotice.premium) {
            items.push({ id: 'premium', label: t('screen.store.premium.title') as string });
        }
        return items;
    }, [autoSyncNotice, t]);

    const visibleEntitlements = entitlements.slice(0, MAX_VISIBLE_ENTITLEMENTS);
    const remainingCount = entitlements.length - visibleEntitlements.length;

    return (
        <BottomSheet
            scrollable
            visible={autoSyncNotice !== null}
            onClose={dismissAutoSyncNotice}
            title={t('screen.store.auto_sync_title')}
            testID='auto-sync-purchases-sheet'
        >
            <View style={[styles.content, { maxWidth: scale(520) }]}>
                <Stack gap='lg' align='center'>
                    <Icon
                        name={PackageCheck}
                        size={iconSize(32)}
                        color={theme.colors.success}
                        backgroundColor={theme.colors.surfaceVariant}
                        borderRadius={scale(36)}
                        padding={scale(16)}
                    />

                    <Text variant='body' color='textSecondary' align='center'>
                        {t('screen.store.auto_sync_message')}
                    </Text>

                    <View style={[styles.list, { gap: theme.spacing.sm }]}>
                        {visibleEntitlements.map((entitlement) => (
                            <View
                                key={entitlement.id}
                                style={[
                                    styles.row,
                                    {
                                        minHeight: scale(48),
                                        backgroundColor: theme.colors.surfaceVariant,
                                        borderColor: theme.colors.borderLight,
                                        borderRadius: theme.radii.md,
                                        paddingHorizontal: theme.spacing.md,
                                        gap: theme.spacing.md,
                                    },
                                ]}
                            >
                                <Icon name={PackageCheck} size={iconSize(18)} color={theme.colors.primary} />
                                <Text variant='body' weight='semibold' numberOfLines={1} style={styles.itemLabel}>
                                    {entitlement.label}
                                </Text>
                                <Icon name={Check} size={iconSize(18)} color={theme.colors.success} />
                            </View>
                        ))}
                        {remainingCount > 0 ? (
                            <Text variant='caption' color='textSecondary' align='center'>
                                {t('screen.store.auto_sync_more', { count: remainingCount })}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.action}>
                        <Button
                            variant='primary'
                            size='lg'
                            fullWidth
                            icon={
                                <Icon name={Check} size={iconSize(20)} color={theme.components.button.primary.text} />
                            }
                            contentGap='sm'
                            onPress={dismissAutoSyncNotice}
                            accessibilityLabel={t('screen.store.auto_sync_confirm')}
                        >
                            {t('screen.store.auto_sync_confirm')}
                        </Button>
                    </View>
                </Stack>
            </View>
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    content: {
        width: '100%',
        alignSelf: 'center',
    },
    list: {
        width: '100%',
    },
    row: {
        width: '100%',
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemLabel: {
        flex: 1,
        minWidth: 0,
    },
    action: {
        width: '100%',
        alignSelf: 'stretch',
    },
});

export default React.memo(AutoSyncedPurchasesSheet);
