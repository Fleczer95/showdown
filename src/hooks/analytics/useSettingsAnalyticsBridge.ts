import { useEffect, useRef } from 'react';
import { SafeAnalytics } from '../../utils/firebase/init';
import { useSettings } from '../useSettings';
import { useThemeActions } from '../../theme';
import { isPremiumCatalogId } from '../../data/store/catalog';

export function useSettingsAnalyticsBridge(): void {
    const { language, soundEffects, hapticFeedback, gameTimers } = useSettings();
    const { themeId } = useThemeActions();

    const initRef = useRef(false);
    const prevLanguage = useRef(language);
    const prevTheme = useRef(themeId);
    const prevSound = useRef(soundEffects);
    const prevHaptics = useRef(hapticFeedback);
    const prevTimers = useRef<Record<string, number>>({ ...gameTimers });

    useEffect(() => {
        if (!initRef.current) {
            initRef.current = true;
            return;
        }

        if (prevLanguage.current !== language) {
            SafeAnalytics.logEvent({
                name: 'language_changed',
                params: { from_locale: prevLanguage.current, to_locale: language },
            });
            prevLanguage.current = language;
        }

        if (prevTheme.current !== themeId) {
            SafeAnalytics.logEvent({
                name: 'theme_changed',
                params: { theme_id: themeId, is_premium: isPremiumCatalogId(`theme-${themeId}`) },
            });
            prevTheme.current = themeId;
        }

        if (prevSound.current !== soundEffects) {
            SafeAnalytics.logEvent({ name: 'sound_effects_toggled', params: { enabled: soundEffects } });
            prevSound.current = soundEffects;
        }

        if (prevHaptics.current !== hapticFeedback) {
            SafeAnalytics.logEvent({ name: 'haptics_toggled', params: { enabled: hapticFeedback } });
            prevHaptics.current = hapticFeedback;
        }

        for (const [gameId, seconds] of Object.entries(gameTimers)) {
            if (prevTimers.current[gameId] !== seconds) {
                SafeAnalytics.logEvent({ name: 'game_timer_changed', params: { game_id: gameId, seconds } });
            }
        }
        prevTimers.current = { ...gameTimers };
    }, [language, themeId, soundEffects, hapticFeedback, gameTimers]);
}
