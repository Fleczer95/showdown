import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Text from '../atoms/Text';
import { useTheme } from '../../theme';
import type { ColorToken } from '../../theme';

export interface ProgressBarProps {
    /** Progress value between 0 and 1 (ignored when indeterminate) */
    progress?: number;
    /** Show indeterminate loading animation */
    indeterminate?: boolean;
    color?: ColorToken | string;
    trackColor?: string;
    height?: number;
    /** Animation duration in ms (default: 300) */
    animationDuration?: number;
    /** Show label text (e.g. '50%' or custom string). Set to true for auto percentage. */
    label?: string | boolean;
    testID?: string;
    accessibilityLabel?: string;
}

function ProgressBar({
    progress = 0,
    indeterminate = false,
    color,
    trackColor,
    height,
    animationDuration,
    label,
    testID,
    accessibilityLabel,
}: ProgressBarProps) {
    const t = useTheme();
    const clampedProgress = indeterminate ? 0.3 : Math.max(0, Math.min(1, progress));
    const barHeight = height ?? t.spacing.sm;
    const progressValue = useSharedValue(clampedProgress);

    useEffect(() => {
        if (indeterminate) {
            // Ping-pong animation for indeterminate state
            progressValue.value = 0;
            const loop = () => {
                progressValue.value = withTiming(1, { duration: animationDuration ?? 1000 }, (finished) => {
                    if (finished) {
                        progressValue.value = withTiming(0, { duration: animationDuration ?? 1000 }, (f2) => {
                            if (f2) loop();
                        });
                    }
                });
            };
            loop();
        } else {
            progressValue.value = withTiming(clampedProgress, { duration: animationDuration ?? 300 });
        }
    }, [clampedProgress, indeterminate, animationDuration, progressValue]);

    const trackStyle = useMemo(
        () => [
            styles.track,
            {
                height: barHeight,
                borderRadius: barHeight / 2,
                backgroundColor: trackColor ?? t.colors.surfaceVariant,
            },
        ],
        [barHeight, trackColor, t.colors],
    );

    const labelText =
        label === true ? `${Math.round(clampedProgress * 100)}%` : typeof label === 'string' ? label : null;

    const fillAnimatedStyle = useAnimatedStyle(() => ({
        width: `${progressValue.value * 100}%`,
    }));

    const fillStyle = useMemo(
        () => ({
            height: barHeight,
            borderRadius: barHeight / 2,
            backgroundColor: color ? (color in t.colors ? t.colors[color as ColorToken] : color) : t.colors.primary,
        }),
        [barHeight, color, t.colors],
    );

    return (
        <View testID={testID} style={labelText ? styles.labeledContainer : undefined}>
            <View
                style={trackStyle}
                accessible
                accessibilityLabel={accessibilityLabel ?? (indeterminate ? 'Loading' : 'Progress')}
                accessibilityRole='progressbar'
                accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedProgress * 100) }}
            >
                <Animated.View style={[styles.fill, fillStyle, fillAnimatedStyle]} />
            </View>
            {labelText && !indeterminate ? (
                <Text variant='caption' color={t.colors.textSecondary} style={styles.label}>
                    {labelText}
                </Text>
            ) : null}
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
    labeledContainer: {
        gap: 4,
    },
    label: {
        textAlign: 'right' as const,
    },
});

export default React.memo(ProgressBar);
