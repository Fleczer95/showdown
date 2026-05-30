import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { useSettings } from './useSettings';

export const useHaptics = () => {
    const { hapticFeedback: enabled } = useSettings();

    const light = useCallback(() => {
        if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [enabled]);

    const medium = useCallback(() => {
        if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [enabled]);

    const heavy = useCallback(() => {
        if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, [enabled]);

    const selection = useCallback(() => {
        if (enabled) Haptics.selectionAsync();
    }, [enabled]);

    const notification = useCallback(
        (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
            if (enabled) Haptics.notificationAsync(type);
        },
        [enabled],
    );

    return {
        light,
        medium,
        heavy,
        selection,
        notification,
    };
};
