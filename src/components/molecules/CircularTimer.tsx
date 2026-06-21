import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import Animated, {
    useSharedValue,
    useFrameCallback,
    useDerivedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    runOnJS,
} from 'react-native-reanimated';
import { useTheme, useAnimationPresets } from '../../theme';
import { useTranslation } from '../../i18n';
import type { ColorToken } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export interface CircularTimerProps {
    /** Timer duration in seconds */
    duration: number;
    /** Seconds remaining when urgency animation kicks in */
    urgencyAt?: number;
    /** Ring color (defaults to theme primary) */
    color?: ColorToken | string;
    /** Canvas size in px */
    size?: number;
    /** Called when timer reaches 0 */
    onEnd?: () => void;
    /** Called when timer reaches urgency threshold */
    onUrgency?: () => void;
    /** Show seconds remaining as text */
    showLabel?: boolean;
    testID?: string;
    accessibilityLabel?: string;
}

const STROKE_WIDTH = 8;

function CircularTimer({
    duration,
    urgencyAt = 5,
    color,
    size = 120,
    onEnd,
    onUrgency,
    showLabel = true,
    testID,
    accessibilityLabel,
}: CircularTimerProps) {
    const t = useTheme();
    const { t: translate } = useTranslation();
    const { pulse } = useAnimationPresets();
    const { scale } = useResponsive();
    
    const scaledSize = scale(size);
    const cx = scaledSize / 2;
    const cy = scaledSize / 2;
    const radius = scaledSize / 2 - STROKE_WIDTH;
    const circumference = 2 * Math.PI * radius;

    const progress = useSharedValue(1);
    const isPulsing = useSharedValue(false);
    const endTime = useSharedValue(0);
    const isEnded = useSharedValue(false);
    const pulseScale = useSharedValue(1);

    const onEndRef = useRef(onEnd);
    onEndRef.current = onEnd;
    const onUrgencyRef = useRef(onUrgency);
    onUrgencyRef.current = onUrgency;

    const [labelText, setLabelText] = useState('');

    // Stroke dashoffset — animated by progress
    const dashOffset = useDerivedValue(() => {
        return (1 - progress.value) * circumference;
    });

    // Ring color — red when urgent
    const ringColor = useDerivedValue(() => {
        return isPulsing.value
            ? t.colors.error
            : color
              ? color in t.colors
                  ? t.colors[color as ColorToken]
                  : color
              : t.colors.primary;
    });

    // Opacity fades with progress
    const ringOpacity = useDerivedValue(() => {
        return Math.max(0, progress.value);
    });

    // Urgency pulse animation on the ring
    useEffect(() => {
        if (isPulsing.value) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(pulse.scale, { duration: pulse.duration }),
                    withTiming(1, { duration: pulse.duration }),
                ),
                -1,
            );
        } else {
            pulseScale.value = withTiming(1, { duration: 200 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPulsing.value, pulse]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    // Frame-accurate timer on UI thread
    const lastLabelUpdate = useSharedValue(0);

    const frameCallback = useFrameCallback(() => {
        'worklet';
        if (endTime.value === 0 || isEnded.value) return;

        const now = Date.now();
        const remaining = Math.max(0, (endTime.value - now) / 1000);

        progress.value = remaining / duration;

        // Update label at ~2Hz
        if (now - lastLabelUpdate.value > 500) {
            lastLabelUpdate.value = now;
            const secs = Math.ceil(remaining);
            const mins = Math.floor(secs / 60);
            const s = secs % 60;
            runOnJS(setLabelText)(mins > 0 ? `${mins}:${s.toString().padStart(2, '0')}` : `${s}`);
        }

        if (remaining <= urgencyAt && !isPulsing.value && remaining > 0) {
            isPulsing.value = true;
            if (onUrgencyRef.current) {
                runOnJS(onUrgencyRef.current)();
            }
        }

        if (remaining <= 0) {
            isEnded.value = true;
            isPulsing.value = false;
            endTime.value = 0;
            runOnJS(setLabelText)('0');
            if (onEndRef.current) {
                runOnJS(onEndRef.current)();
            }
        }
    });

    useEffect(() => {
        frameCallback.setActive(true);
        return () => frameCallback.setActive(false);
    }, [frameCallback]);

    // Start timer
    useEffect(() => {
        progress.value = 1;
        isPulsing.value = false;
        isEnded.value = false;
        pulseScale.value = 1;
        endTime.value = Date.now() + duration * 1000;
        const secs = duration;
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        setLabelText(mins > 0 ? `${mins}:${s.toString().padStart(2, '0')}` : `${s}`);
        return () => {
            endTime.value = 0;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [duration]);

    // AppState listener — re-sync on foreground return
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active' && endTime.value > 0) {
                const remaining = (endTime.value - Date.now()) / 1000;
                progress.value = Math.max(0, remaining / duration);
                isPulsing.value = remaining <= urgencyAt && remaining > 0;
            }
        });
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fontSize = Math.round(scaledSize * 0.22);

    return (
        <View
            style={[styles.container, { width: scaledSize, height: scaledSize }]}
            testID={testID}
            accessible
            accessibilityLabel={accessibilityLabel ?? translate('common.timer')}
            accessibilityRole='timer'
        >
            <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
                <Canvas style={StyleSheet.absoluteFill}>
                    {/* Background ring */}
                    <Circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        color={t.colors.borderLight}
                        style='stroke'
                        strokeWidth={STROKE_WIDTH}
                    />
                    {/* Progress ring */}
                    <Circle
                        {...({
                            cx,
                            cy,
                            r: radius,
                            color: ringColor,
                            style: 'stroke' as const,
                            strokeWidth: STROKE_WIDTH,
                            strokeCap: 'round' as const,
                            opacity: ringOpacity,
                            strokeDasharray: circumference,
                            strokeDashoffset: dashOffset,
                        } as any)}
                    />
                </Canvas>
            </Animated.View>
            {/* Timer label — overlaid via RN Animated.Text for proper text rendering */}
            {showLabel && (
                <View style={[styles.label, { width: scaledSize, height: scaledSize }]}>
                    <Animated.Text
                        style={[
                            styles.labelText,
                            {
                                fontSize,
                                color: t.colors.text,
                            },
                        ]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={1.5}
                    >
                        {labelText}
                    </Animated.Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    labelText: {
        fontWeight: '600',
        includeFontPadding: false,
    },
});

export default React.memo(CircularTimer);
