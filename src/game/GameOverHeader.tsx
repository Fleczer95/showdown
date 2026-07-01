import React from 'react';
import { StyleSheet } from 'react-native';
import Stack from '../components/atoms/Stack';
import { MascotOverlay } from './mascot/MascotOverlay';
import { MASCOT_ASPECT } from './mascot/Mascot';
import type { MascotPose } from './mascot/look';

interface GameOverHeaderProps {
    pose: MascotPose;
    children: React.ReactNode;
}

const MASCOT_SIZE = 150;
const HEADER_MIN_HEIGHT = MASCOT_SIZE * MASCOT_ASPECT;
const COPY_OFFSET_Y = 12;

function GameOverHeader({ pose, children }: GameOverHeaderProps) {
    return (
        <Stack direction='horizontal' gap='md' align='center' style={styles.row}>
            <Stack align='center' justify='center' style={styles.column}>
                <MascotOverlay inline pose={pose} size={MASCOT_SIZE} />
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
