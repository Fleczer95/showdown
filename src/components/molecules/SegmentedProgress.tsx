import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import type { ColorToken } from '../../theme';
import { hexToRgba } from '../../theme/colorUtils';
import { useResponsive } from '../../responsive/useResponsive';

export interface SegmentedProgressProps {
    /** Progress value between 0 and 1. */
    progress: number;
    /** Number of segments (default: 12). */
    segments?: number;
    /** Fill color — theme token or raw color (default: primary). */
    color?: ColorToken | string;
    /** Applied to the row container (e.g. `{ flex: 1 }` to fill a horizontal parent). */
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

const SEGMENTS_DEFAULT = 12;

/**
 * Segmented progress meter: a row of glowing pips (▰▰▰▱▱) where the leading pip
 * can be partially filled. Shared by the Home level bar and the Progress screen so
 * both render level progress identically.
 */
function SegmentedProgress({ progress, segments = SEGMENTS_DEFAULT, color, style, accessibilityLabel }: SegmentedProgressProps) {
    const theme = useTheme();
    const { scale } = useResponsive();
    const fillColor = color ? (color in theme.colors ? theme.colors[color as ColorToken] : color) : theme.colors.primary;
    const trackColor = hexToRgba(fillColor, 0.2);

    const clamped = Math.max(0, Math.min(1, progress));
    const filledExact = clamped * segments;
    const fullPips = Math.floor(filledExact);
    const partial = filledExact - fullPips; // fractional fill of the leading segment (0–1)

    return (
        <View
            style={[styles.row, { gap: scale(4) }, style]}
            accessible
            accessibilityRole='progressbar'
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        >
            {Array.from({ length: segments }).map((_, i) => {
                if (i < fullPips) {
                    return <View key={i} style={[styles.pip, { height: scale(8), backgroundColor: fillColor, shadowColor: fillColor }]} />;
                }
                if (i === fullPips && partial > 0) {
                    return (
                        <View key={i} style={[styles.pip, { height: scale(8), backgroundColor: trackColor }]}>
                            <View
                                style={[
                                    styles.partial,
                                    { height: scale(8), width: `${partial * 100}%`, backgroundColor: fillColor, shadowColor: fillColor },
                                ]}
                            />
                        </View>
                    );
                }
                return <View key={i} style={[styles.pip, { height: scale(8), backgroundColor: trackColor }]} />;
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pip: {
        flex: 1,
        borderRadius: 9999,
        overflow: 'hidden',
        shadowOpacity: 0.6,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
        elevation: 3,
    },
    partial: {
        borderRadius: 9999,
    },
});

export default React.memo(SegmentedProgress);
