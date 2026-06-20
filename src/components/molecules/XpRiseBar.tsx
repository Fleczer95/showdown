import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSequence,
    runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { ColorToken } from '../../theme';

export interface XpRiseBarProps {
    /** Fill (0..1) within the level band the player was in before this run. */
    prevFill: number;
    /** Fill (0..1) within the level band the player is in after this run. */
    newFill: number;
    /** Whether this run crossed a level threshold (drives the rollover). */
    leveledUp: boolean;
    color?: ColorToken | string;
    trackColor?: string;
    /** When set, casts a soft glow in this color around the bar. */
    glowColor?: string;
    height?: number;
    /** Delay before the rise starts (ms), to let the card settle first. */
    startDelay?: number;
    /** Fired once, the moment the bar first reaches full on a level-up. */
    onRollover?: () => void;
    testID?: string;
}

const RISE_MS = 700;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The post-game XP bar. Unlike ProgressBar (which initialises to its final fill),
 * this starts at the player's previous band position and *rises* to the new one.
 * On a level-up it rolls over: fills to 100%, fires `onRollover` (the moment the
 * parent flips the level number / bursts confetti), snaps back to 0, then settles
 * in the new band.
 */
function XpRiseBar({
    prevFill,
    newFill,
    leveledUp,
    color,
    trackColor,
    glowColor,
    height,
    startDelay = 150,
    onRollover,
    testID,
}: XpRiseBarProps) {
    const t = useTheme();
    const barHeight = height ?? t.spacing.sm;
    const progress = useSharedValue(clamp(prevFill));

    // Run the rise exactly once on mount — the diff that drives it is fixed.
    useEffect(() => {
        const to = clamp(newFill);
        if (leveledUp) {
            progress.value = withDelay(
                startDelay,
                withSequence(
                    withTiming(1, { duration: RISE_MS }, (finished) => {
                        if (finished && onRollover) runOnJS(onRollover)();
                    }),
                    withTiming(0, { duration: 0 }),
                    withTiming(to, { duration: RISE_MS }),
                ),
            );
        } else {
            progress.value = withDelay(startDelay, withTiming(to, { duration: RISE_MS }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fillAnimatedStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const fillColor = color ? (color in t.colors ? t.colors[color as ColorToken] : color) : t.colors.primary;

    return (
        <View testID={testID} style={glowColor ? [styles.glow, { shadowColor: glowColor }] : undefined}>
            <View
                style={[
                    styles.track,
                    {
                        height: barHeight,
                        borderRadius: barHeight / 2,
                        backgroundColor: trackColor ?? t.colors.surfaceVariant,
                    },
                ]}
                accessible
                accessibilityRole='progressbar'
                accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(newFill) * 100) }}
            >
                <Animated.View
                    style={[
                        styles.fill,
                        { height: barHeight, borderRadius: barHeight / 2, backgroundColor: fillColor },
                        fillAnimatedStyle,
                    ]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        width: '100%',
        overflow: 'hidden',
    },
    fill: {
        width: '0%',
    },
    glow: {
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
});

export default React.memo(XpRiseBar);
