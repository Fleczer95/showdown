import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/** Date-based copy refreshes on focus/foreground, without polling hidden screens. */
export function useEventNow() {
    const [now, setNow] = useState(Date.now);
    useFocusEffect(
        useCallback(() => {
            const refresh = () => setNow(Date.now());
            refresh();
            const timer = setInterval(refresh, 60000);
            const listener = AppState.addEventListener('change', (state) => {
                if (state === 'active') refresh();
            });
            return () => {
                clearInterval(timer);
                listener.remove();
            };
        }, []),
    );
    return now;
}
