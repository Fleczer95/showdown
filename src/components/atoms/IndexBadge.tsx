import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from './Text';
import { useTheme } from '../../theme';
import { readableOn } from '../../theme/colorUtils';

export type IndexBadgeState = 'default' | 'correct' | 'wrong' | 'muted';

export interface IndexBadgeProps {
    /** Letter or number shown inside the medallion (e.g. 'A', '1'). */
    label: string;
    /** Per-game accent used for the default (unresolved) fill. */
    accent: string;
    /** Recolors the medallion to mirror an option's reveal state. */
    state?: IndexBadgeState;
    /** Square edge length. Defaults to 40. */
    size?: number;
    testID?: string;
}

/**
 * Solid-fill letter medallion echoing the app's accent medallion motif (Home /
 * Setup). Carries the per-game accent in active play screens and recolors to
 * success/error on reveal, giving answer options a bold, on-brand index marker.
 */
function IndexBadge({ label, accent, state = 'default', size = 40, testID }: IndexBadgeProps) {
    const t = useTheme();

    const stateFill = { correct: t.colors.success, wrong: t.colors.error, muted: t.colors.surfaceVariant };
    const fill = stateFill[state as keyof typeof stateFill] ?? accent;
    const glyph = state === 'muted' ? t.colors.textMuted : readableOn(fill);

    return (
        <View
            style={[styles.base, { width: size, height: size, borderRadius: t.radii.md, backgroundColor: fill }]}
            testID={testID}
            pointerEvents='none'
        >
            <Text variant='subheading' weight='bold' color={glyph}>
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default React.memo(IndexBadge);
