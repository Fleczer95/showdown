import { useEffect, useRef } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { SafeAnalytics } from '../../utils/firebase/init';
import { useSettings } from '../useSettings';
import { useThemeActions } from '../../theme';
import { useStore } from '../store/useStore';

const firstGameStorage = createMMKV({ id: 'showdown-analytics' });
const FIRST_GAME_KEY = 'has_completed_first_game';

export function readHasCompletedFirstGame(): boolean {
    return firstGameStorage.getBoolean(FIRST_GAME_KEY) ?? false;
}

export function markFirstGameCompleted(): void {
    if (firstGameStorage.getBoolean(FIRST_GAME_KEY)) return;
    firstGameStorage.set(FIRST_GAME_KEY, true);
    SafeAnalytics.setUserProperty('has_completed_first_game', 'true');
}

export function useUserPropertiesSync(): void {
    const { language } = useSettings();
    const { themeId } = useThemeActions();
    const { purchasedItemIds } = useStore();
    const initialisedRef = useRef(false);

    useEffect(() => {
        SafeAnalytics.setUserProperty('user_locale', language);
    }, [language]);

    useEffect(() => {
        SafeAnalytics.setUserProperty('current_theme', themeId);
    }, [themeId]);

    useEffect(() => {
        const count = purchasedItemIds.length;
        SafeAnalytics.setUserProperty('is_paying_user', count > 0 ? 'true' : 'false');
        SafeAnalytics.setUserProperty('total_packs_owned', String(count));
        if (!initialisedRef.current) {
            initialisedRef.current = true;
            if (readHasCompletedFirstGame()) {
                SafeAnalytics.setUserProperty('has_completed_first_game', 'true');
            }
        }
    }, [purchasedItemIds]);
}
