import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Stack from '../components/atoms/Stack';
import { MascotOverlay } from './mascot/MascotOverlay';
import { MASCOT_ASPECT } from './mascot/Mascot';
import type { MascotPose } from './mascot/look';
import { useMascotEmit, useMascotState } from './mascot/reactions/useMascotDirector';
import { useTranslation } from '../i18n';

interface GameOverHeaderProps {
    pose: MascotPose;
    children: React.ReactNode;
}

const MASCOT_SIZE = 150;
const HEADER_MIN_HEIGHT = MASCOT_SIZE * MASCOT_ASPECT;
const COPY_OFFSET_Y = 12;
const RUN_END_BUBBLE_MS = 4500;

/**
 * The results-screen fox. It emits the run-end reaction to the director (which
 * picks a varied line + expression under the usual pacing rules) and renders the
 * result on its own inline mascot — so the host stays offstage on the game surface
 * and the round never shows two foxes. Win/loss is read from `pose`
 * (cheer = won, dismay = lost), so no game needs to change its call.
 */
function GameOverHeader({ pose, children }: GameOverHeaderProps) {
    const won = pose === 'cheer';
    const emit = useMascotEmit();
    const { state, chatter, onAutoHide } = useMascotState();
    const { t } = useTranslation();

    useEffect(() => {
        emit(won ? 'run-won' : 'run-lost');
    }, [emit, won]);

    const u = state.utterance;
    const isRunEnd = u?.bucketId === 'run-won' || u?.bucketId === 'run-lost';
    const message = chatter && isRunEnd && u?.textKey ? t(u.textKey, u.ctx) : null;
    const expression = isRunEnd ? state.expression : undefined;

    return (
        <Stack direction='horizontal' gap='md' align='center' style={styles.row}>
            <Stack align='center' justify='center' style={styles.column}>
                <MascotOverlay
                    inline
                    anchor='bottom-left'
                    pose={pose}
                    size={MASCOT_SIZE}
                    expression={expression}
                    message={message}
                    autoHideMs={RUN_END_BUBBLE_MS}
                    onAutoHide={onAutoHide}
                />
            </Stack>
            <Stack gap='md' align='center' justify='center' flex={1} style={[styles.column, styles.copyColumn]}>
                {children}
            </Stack>
        </Stack>
    );
}

const styles = StyleSheet.create({
    row: {
        minHeight: HEADER_MIN_HEIGHT,
    },
    column: {
        minHeight: HEADER_MIN_HEIGHT,
    },
    copyColumn: {
        transform: [{ translateY: COPY_OFFSET_Y }],
    },
});

export default React.memo(GameOverHeader);
