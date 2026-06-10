import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Store, Volume2, Smartphone } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Pressable from '../components/atoms/HapticPressable';
import IconButton from '../components/molecules/IconButton';
import Switch from '../components/molecules/Switch';
import SelectionList from '../components/molecules/SelectionList';
import Divider from '../components/atoms/Divider';
import { useTheme, useThemeActions, themeRegistry } from '../theme';
import { useTranslation } from '../i18n';
import { useSettings } from '../hooks/useSettings';
import { useStore } from '../hooks/store/useStore';
import { useProgression } from '../hooks/useProgression';
import { useResponsive } from '../responsive/useResponsive';
import { FULL_VERSION_STRING } from '../utils/version';

/**
 * Settings screen. Allows users to customize themes, timers, sounds,
 * haptics, and language.
 */
export function SettingsScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const theme = useTheme();
    const { themeId, setTheme } = useThemeActions();
    const settings = useSettings();
    const { purchasedItemIds } = useStore();
    const { unlockedRewards } = useProgression();
    const { scale } = useResponsive();

    const handleBack = () => navigation.goBack();

    const themeOptions = themeRegistry.map((opt) => ({
        value: opt.value,
        label: opt.isEarned ? `${t(opt.labelKey as any)} ✦` : t(opt.labelKey as any),
        icon: opt.icon,
        isPremium: opt.isPremium,
        isEarned: opt.isEarned,
        // Earned themes resolve their lock against unlocked map rewards, not purchases.
        isLocked: opt.isEarned
            ? !unlockedRewards.has(opt.rewardId!)
            : opt.isPremium && !purchasedItemIds.includes(`theme-${opt.value}`),
    }));

    const handleThemeChange = (nextThemeId: string) => {
        const option = themeOptions.find((themeOption) => themeOption.value === nextThemeId);
        if (option?.isLocked) {
            // Earned themes aren't for sale — point at the Progress screen, not the Store.
            navigation.navigate((option.isEarned ? 'Progress' : 'Store') as any, { gameId: 'themes' });
            return;
        }
        setTheme(nextThemeId);
    };

    const languageOptions = [
        { value: 'en', label: t('screen.settings.labels.language_en') },
        { value: 'pl', label: t('screen.settings.labels.language_pl') },
    ];

    return (
        <SafeContainer edges={['top', 'bottom']}>
            {/* Header */}
            <View
                style={[
                    styles.header,
                    { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
                ]}
            >
                <IconButton
                    icon={<ChevronLeft size={24} color={theme.colors.text} />}
                    onPress={handleBack}
                    size='md'
                    accessibilityLabel={t('screen.settings.back')}
                />
                <Text variant='heading' weight='bold' style={styles.title}>
                    {t('screen.settings.title')}
                </Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl + theme.spacing.sm },
                ]}
            >
                <Stack gap='xl'>
                    {/* Appearance */}
                    <Stack gap='md'>
                        <Text
                            variant='caption'
                            weight='bold'
                            color={theme.colors.textSecondary}
                            style={[styles.sectionLabel, { marginBottom: theme.spacing.xs }]}
                        >
                            {t('screen.settings.sections.appearance')}
                        </Text>
                        <SelectionList
                            label={t('screen.settings.labels.theme')}
                            value={[themeId]}
                            options={themeOptions}
                            onChange={handleThemeChange}
                            numColumns={2}
                        />
                        <Pressable
                            style={[styles.storeButton, { paddingVertical: theme.spacing.sm }]}
                            onPress={() => navigation.navigate('Store' as any, { gameId: 'themes' })}
                            haptic='light'
                            accessibilityLabel={t('screen.store.title')}
                        >
                            <View pointerEvents='none' style={styles.storeButtonContent}>
                                <Store size={scale(18)} color={theme.colors.primary} />
                                <Text variant='body' color={theme.colors.primary} weight='semibold'>
                                    {t('screen.settings.labels.store')}
                                </Text>
                            </View>
                        </Pressable>
                    </Stack>

                    <Divider />

                    {/* Feedback */}
                    <Stack gap='md'>
                        <Text
                            variant='caption'
                            weight='bold'
                            color={theme.colors.textSecondary}
                            style={[styles.sectionLabel, { marginBottom: theme.spacing.xs }]}
                        >
                            {t('screen.settings.sections.feedback')}
                        </Text>

                        <View style={[styles.row, { paddingVertical: theme.spacing.sm }]}>
                            <Stack direction='horizontal' gap='sm' align='center'>
                                <Volume2 size={scale(20)} color={theme.colors.textSecondary} />
                                <Text variant='body' weight='medium'>
                                    {t('screen.settings.labels.soundEffects')}
                                </Text>
                            </Stack>
                            <Switch
                                value={settings.soundEffects}
                                onValueChange={settings.setSoundEffects}
                            />
                        </View>

                        <View style={[styles.row, { paddingVertical: theme.spacing.sm }]}>
                            <Stack direction='horizontal' gap='sm' align='center'>
                                <Smartphone size={scale(20)} color={theme.colors.textSecondary} />
                                <Text variant='body' weight='medium'>
                                    {t('screen.settings.labels.hapticFeedback')}
                                </Text>
                            </Stack>
                            <Switch
                                value={settings.hapticFeedback}
                                onValueChange={settings.setHapticFeedback}
                            />
                        </View>
                    </Stack>

                    <Divider />

                    {/* Language */}
                    <Stack gap='md'>
                        <Text
                            variant='caption'
                            weight='bold'
                            color={theme.colors.textSecondary}
                            style={[styles.sectionLabel, { marginBottom: theme.spacing.xs }]}
                        >
                            {t('screen.settings.sections.language')}
                        </Text>
                        <SelectionList
                            value={[settings.language]}
                            options={languageOptions}
                            onChange={settings.setLanguage}
                        />
                    </Stack>

                    <Divider />

                    {/* About */}
                    <Stack gap='md'>
                        <Text
                            variant='caption'
                            weight='bold'
                            color={theme.colors.textSecondary}
                            style={[styles.sectionLabel, { marginBottom: theme.spacing.xs }]}
                        >
                            {t('screen.settings.sections.about')}
                        </Text>

                        <View style={[styles.aboutRow, { paddingVertical: theme.spacing.xs }]}>
                            <Text variant='body'>{t('screen.settings.labels.version')}</Text>
                            <Text variant='body' color={theme.colors.textSecondary}>
                                {FULL_VERSION_STRING}
                            </Text>
                        </View>

                        <Pressable
                            style={[styles.linkButton, { paddingVertical: theme.spacing.sm }]}
                            onPress={() => navigation.navigate('privacyPolicy' as any)}
                            haptic='light'
                            accessibilityLabel={t('screen.settings.labels.privacyPolicy')}
                            accessibilityRole='link'
                        >
                            <Text variant='body' color={theme.colors.primary}>
                                {t('screen.settings.labels.privacyPolicy')}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[styles.linkButton, { paddingVertical: theme.spacing.sm }]}
                            onPress={() => navigation.navigate('termsOfUse' as any)}
                            haptic='light'
                            accessibilityLabel={t('screen.settings.labels.termsOfUse')}
                            accessibilityRole='link'
                        >
                            <Text variant='body' color={theme.colors.primary}>
                                {t('screen.settings.labels.termsOfUse')}
                            </Text>
                        </Pressable>
                    </Stack>

                    <Stack
                        gap='sm'
                        align='center'
                        style={[
                            styles.footer,
                            { marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl },
                        ]}
                    >
                        <Text variant='caption' color={theme.colors.textMuted}>
                            © 2026 ShowDown Games
                        </Text>
                    </Stack>
                </Stack>
            </ScrollView>
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
    content: {
        // dynamic spacing moved
    },
    sectionLabel: {
        letterSpacing: 1.2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    aboutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    linkButton: {
        // dynamic spacing moved
    },
    storeButton: {
        alignSelf: 'flex-start',
    },
    storeButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    footer: {
        // dynamic spacing moved
    },
});
