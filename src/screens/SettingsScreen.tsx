import React from 'react';
import { ScrollView, StyleSheet, View, Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Volume2, Smartphone, Languages } from 'lucide-react-native';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Stack from '../components/atoms/Stack';
import Icon from '../components/atoms/Icon';
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
    const { scale } = useResponsive();

    const handleBack = () => navigation.goBack();

    const themeOptions = themeRegistry.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey as any),
        icon: opt.icon,
        isPremium: opt.isPremium,
    }));

    const languageOptions = [
        { value: 'en', label: t('screen.settings.labels.language_en') },
        { value: 'pl', label: t('screen.settings.labels.language_pl') },
    ];

    const openLink = async (url: string) => {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        }
    };

    return (
        <SafeContainer edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
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

            <ScrollView contentContainerStyle={styles.content}>
                <Stack gap='xl'>
                    {/* Appearance */}
                    <Stack gap='md'>
                        <Text variant='caption' weight='bold' color={theme.colors.textSecondary} style={styles.sectionLabel}>
                            {t('screen.settings.sections.appearance')}
                        </Text>
                        <SelectionList
                            label={t('screen.settings.labels.theme')}
                            value={[themeId]}
                            options={themeOptions}
                            onChange={setTheme}
                            numColumns={2}
                        />
                    </Stack>

                    <Divider />

                    {/* Feedback */}
                    <Stack gap='md'>
                        <Text variant='caption' weight='bold' color={theme.colors.textSecondary} style={styles.sectionLabel}>
                            {t('screen.settings.sections.feedback')}
                        </Text>
                        
                        <View style={styles.row}>
                            <Stack direction='horizontal' gap='sm' align='center'>
                                <Volume2 size={scale(20)} color={theme.colors.textSecondary} />
                                <Text variant='body' weight='medium'>{t('screen.settings.labels.soundEffects')}</Text>
                            </Stack>
                            <Switch 
                                value={settings.soundEffects} 
                                onValueChange={settings.setSoundEffects}
                            />
                        </View>

                        <View style={styles.row}>
                            <Stack direction='horizontal' gap='sm' align='center'>
                                <Smartphone size={scale(20)} color={theme.colors.textSecondary} />
                                <Text variant='body' weight='medium'>{t('screen.settings.labels.hapticFeedback')}</Text>
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
                        <Text variant='caption' weight='bold' color={theme.colors.textSecondary} style={styles.sectionLabel}>
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
                        <Text variant='caption' weight='bold' color={theme.colors.textSecondary} style={styles.sectionLabel}>
                            {t('screen.settings.sections.about')}
                        </Text>
                        
                        <View style={styles.aboutRow}>
                            <Text variant='body'>{t('screen.settings.labels.version')}</Text>
                            <Text variant='body' color={theme.colors.textSecondary}>{FULL_VERSION_STRING}</Text>
                        </View>

                        <Pressable 
                            style={styles.linkButton} 
                            onPress={() => navigation.navigate('privacyPolicy' as any)}
                            haptic='light'
                        >
                            <Text variant='body' color={theme.colors.primary}>{t('screen.settings.labels.privacyPolicy')}</Text>
                        </Pressable>

                        <Pressable 
                            style={styles.linkButton} 
                            onPress={() => navigation.navigate('termsOfUse' as any)}
                            haptic='light'
                        >
                            <Text variant='body' color={theme.colors.primary}>{t('screen.settings.labels.termsOfUse')}</Text>
                        </Pressable>
                    </Stack>

                    <Stack gap='sm' align='center' style={styles.footer}>
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
        paddingHorizontal: 8,
        paddingVertical: 12,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionLabel: {
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    aboutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    linkButton: {
        paddingVertical: 8,
    },
    footer: {
        marginTop: 20,
        marginBottom: 20,
    },
});
