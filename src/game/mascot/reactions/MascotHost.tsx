import React, { useEffect } from 'react';
import { useTranslation } from '../../../i18n';
import { MascotOverlay } from '../MascotOverlay';
import type { MascotPose } from '../look';
import { useMascotState } from './useMascotDirector';

const BUBBLE_MS = 4000; // spoken bubble dwell before auto-hide
const PEEK_MS = 1600; // expression-only mid-run peek before the fox slips away

/**
 * The single app-root mascot. It is a RESIDENT on Home (always present: greetings,
 * idle drip, ambient expression) and an occasional GUEST everywhere else (offstage
 * until a reaction, then it peeks in and slips away). Visibility + hide timing live
 * here; the director owns which reaction to show.
 */
export function MascotHost() {
    const { t } = useTranslation();
    const { state, surface, chatter, onAutoHide } = useMascotState();
    const { utterance, expression } = state;

    const message = chatter && utterance?.textKey ? t(utterance.textKey, utterance.ctx) : null;
    const visible = surface === 'home' || utterance != null;

    // Off-Home, any reaction (spoken or expression-only) auto-clears so the fox
    // returns offstage. On Home the fox stays; spoken bubbles still time out, and
    // the idle drip self-manages its own show/hide via the director's tick.
    useEffect(() => {
        if (!utterance) return;
        const spoken = utterance.textKey != null;
        if (surface === 'home' && !spoken) return; // ambient Home expression: leave it
        const ms = spoken ? BUBBLE_MS : PEEK_MS;
        const id = setTimeout(onAutoHide, ms);
        return () => clearTimeout(id);
    }, [utterance, surface, onAutoHide]);

    if (!visible) return null;

    const pose: MascotPose =
        utterance?.bucketId === 'run-won' ? 'cheer' : utterance?.bucketId === 'run-lost' ? 'dismay' : 'idle';

    // Replay the slide-in entrance whenever the fox appears / a new reaction lands.
    const replayKey = utterance ? `${utterance.bucketId}:${expression}` : `home:${expression}`;

    return (
        <MascotOverlay
            pose={pose}
            expression={expression}
            message={message}
            replayKey={replayKey}
            onMessagePress={onAutoHide}
            anchor='bottom-right'
            size={120}
            offset={{ x: -4, y: 64 }}
        />
    );
}
