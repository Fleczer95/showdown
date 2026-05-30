import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { SafeAnalytics } from '../../utils/firebase/init';
import { useGameSession } from './useGameSession';

export function useAppStateTracker(): void {
    const { activeSession } = useGameSession();
    const backgroundedAtRef = useRef<number | null>(null);
    const sessionRef = useRef(activeSession);
    sessionRef.current = activeSession;

    useEffect(() => {
        const onChange = (status: AppStateStatus) => {
            const session = sessionRef.current;
            if (!session || session.completed) return;
            if (status === 'background' || status === 'inactive') {
                backgroundedAtRef.current = Date.now();
                SafeAnalytics.logEvent({
                    name: 'app_backgrounded',
                    params: {
                        game_session_id: session.id,
                        game_id: session.gameId,
                        round_number: session.roundsPlayed + 1,
                        time_remaining_ms: 0,
                    },
                });
            } else if (status === 'active' && backgroundedAtRef.current) {
                const seconds_in_background = Math.round((Date.now() - backgroundedAtRef.current) / 1000);
                backgroundedAtRef.current = null;
                SafeAnalytics.logEvent({
                    name: 'app_foregrounded',
                    params: {
                        game_session_id: session.id,
                        game_id: session.gameId,
                        round_number: session.roundsPlayed + 1,
                        time_remaining_ms: 0,
                        seconds_in_background,
                    },
                });
            }
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => sub.remove();
    }, []);
}
