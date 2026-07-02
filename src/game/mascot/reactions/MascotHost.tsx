import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../i18n';
import { MascotOverlay } from '../MascotOverlay';
import type { MascotPose } from '../look';
import { useMascotState } from './useMascotDirector';

const BUBBLE_MS = 4000; // spoken bubble dwell before auto-hide
const PEEK_MS = 1600; // expression-only mid-run peek before the fox slips away
const BOTTOM_GAP = 64; // clearance above the safe area (matches the old in-screen placement)

/**
 * The single app-root mascot. It is a RESIDENT on Home (always present: greetings,
 * idle drip, ambient expression) and an occasional GUEST everywhere else (offstage
 * until a reaction, then it peeks in and slips away). Visibility + hide timing live
 * here; the director owns which reaction to show.
 */
export function MascotHost() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { state, surface, chatter, onAutoHide } = useMascotState();
    const { utterance, expression } = state;

    const message = chatter && utterance?.textKey ? t(utterance.textKey, utterance.ctx) : null;
    // The game surface owns its own fox (the inline results header). The app-root
    // host stays fully offstage there so a round never has two foxes.
    const visible = surface !== 'game' && (surface === 'home' || utterance != null);

    // Every reaction auto-clears so nothing gets stranded on screen — spoken
    // bubbles after a dwell, expression-only peeks sooner. The idle drip is the
    // sole exception: the director's tick owns its show/hide cadence.
    useEffect(() => {
        if (!utterance || utterance.bucketId === 'idle') return;
        const ms = utterance.textKey != null ? BUBBLE_MS : PEEK_MS;
        const id = setTimeout(onAutoHide, ms);
        return () => clearTimeout(id);
    }, [utterance, onAutoHide]);

    if (!visible) return null;

    const pose: MascotPose =
        utterance?.bucketId === 'run-won' ? 'cheer' : utterance?.bucketId === 'run-lost' ? 'dismay' : 'idle';

    // Replay the slide-in only when the fox actually (re)appears. On Home it is a
    // resident: it slides in once on arrival (the key is constant), then stays put
    // while idle lines and expressions change — no re-entrance every few seconds.
    // Off-Home each guest peek is a fresh mount, so a constant key is enough there.
    const replayKey = surface === 'home' ? 'home' : (utterance?.bucketId ?? 'guest');

    return (
        <MascotOverlay
            pose={pose}
            expression={expression}
            message={message}
            replayKey={replayKey}
            onMessagePress={onAutoHide}
            anchor='bottom-right'
            size={120}
            // The host lives at the app root (no safe-area container), so add the
            // bottom inset back — restoring the fox to the empty space above Home's
            // footer button rather than dropping it onto the button.
            offset={{ x: -4, y: BOTTOM_GAP + insets.bottom }}
        />
    );
}
