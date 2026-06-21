import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Palette, Volume2, Smartphone } from 'lucide-react-native';
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
import { useResponsive } from '../responsive/useResponsive';
import { FULL_VERSION_STRING } from '../utils/version';
import ReviewPromptModal from '../components/molecules/ReviewPromptModal'; // TEMP: debug review preview — remove before release
import { acceptReview } from '../services/review/reviewPrompt'; // TEMP: remove before release

/**
 * Settings screen. Allows users to customize themes, timers, sounds,
 * haptics, and language.
 */
export function SettingsScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const theme = useTheme();
    const { themeId } = useThemeActions();
    const settings = useSettings();
    const { scale, tabletColumn, iconSize } = useResponsive();
    const [reviewPreview, setReviewPreview] = React.useState(false); // TEMP: remove before release

    const handleBack = () => navigation.goBack();

    // The picker now lives on its own screen; Settings just surfaces the current
    // selection on a disclosure row.
    const currentTheme = themeRegistry.find((opt) => opt.value === themeId);
    const currentThemeLabel = currentTheme ? t(currentTheme.labelKey as any) : '';

    const languageOptions = [
        { value: 'en', label: t('screen.settings.labels.language_en') },
        { value: 'pl', label: t('screen.settings.labels.language_pl') },
    ];

    return (
        <SafeContainer edges={['top', 'bottom']} enableLeftSwipe>
            {/* Header */}
            <View
                style={[
                    styles.header,
                    { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
                ]}
            >
                <IconButton
                    icon={<ChevronLeft size={iconSize(24)} color={theme.colors.text} />}
                    onPress={handleBack}
                    size='md'
                    accessibilityLabel={t('screen.settings.back')}
                />
                <Text variant='heading' weight='bold' style={styles.title}>
                    {t('screen.settings.title')}
                </Text>
                <View style={{ width: scale(44) }} />
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xxl + theme.spacing.sm },
                    tabletColumn,
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
                        <Pressable
                            style={[styles.row, { paddingVertical: theme.spacing.sm }]}
                            onPress={() => navigation.navigate('Theme' as any)}
                            haptic='light'
                            accessibilityRole='button'
                            accessibilityLabel={t('screen.settings.labels.theme')}
                        >
                            <Stack direction='horizontal' gap='sm' align='center'>
                                <Palette size={scale(20)} color={theme.colors.textSecondary} />
                                <Text variant='body' weight='medium'>
                                    {t('screen.settings.labels.theme')}
                                </Text>
                            </Stack>
                            <Stack direction='horizontal' gap='xs' align='center'>
                                <Text variant='body' color={theme.colors.textSecondary}>
                                    {currentThemeLabel}
                                </Text>
                                <ChevronRight size={scale(20)} color={theme.colors.textMuted} />
                            </Stack>
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

                        {/* TEMP: preview the rate pre-prompt modal — remove before release */}
                        <Pressable
                            style={[styles.linkButton, { paddingVertical: theme.spacing.sm }]}
                            onPress={() => setReviewPreview(true)}
                            haptic='light'
                            accessibilityRole='button'
                        >
                            <Text variant='body' color={theme.colors.primary}>
                                [DEBUG] Preview rate prompt
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

            {/* TEMP: rate pre-prompt preview — remove before release */}
            <ReviewPromptModal
                visible={reviewPreview}
                onRate={() => {
                    setReviewPreview(false);
                    void acceptReview();
                }}
                onDismiss={() => setReviewPreview(false)}
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
    footer: {
        // dynamic spacing moved
    },
});
