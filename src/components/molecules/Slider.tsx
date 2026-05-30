import React, { useCallback, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import Text from '../atoms/Text';
import { useHaptics } from '../../hooks/useHaptics';
import { useResponsive } from '../../responsive/useResponsive';

export interface SliderProps {
    label?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    accentColor?: string;
    leftIcon?: React.ReactNode;
    renderValue?: (value: number) => string | number;
}

const THUMB_SIZE = 24; // phone baseline; scaled fluidly below
const TRACK_HEIGHT = 6;

export default function Slider({
    label,
    value,
    min,
    max,
    step = 1,
    onChange,
    accentColor,
    leftIcon,
    renderValue,
}: SliderProps) {
    const t = useTheme();
    const haptics = useHaptics();
    const { scale } = useResponsive();
    const [trackWidth, setTrackWidth] = useState(0);
    const activeAccent = accentColor || t.colors.primary;

    // Fluid sizing — thumb is referenced in the gesture worklet, so resolve it here.
    const thumbSize = scale(THUMB_SIZE);
    const trackHeight = scale(TRACK_HEIGHT);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        setTrackWidth(event.nativeEvent.layout.width);
    }, []);

    const isPressed = useSharedValue(false);
    const offset = useSharedValue(0);

    React.useEffect(() => {
        if (trackWidth > 0 && !isPressed.value) {
            const initialPercent = (value - min) / (max - min);
            offset.value = initialPercent * trackWidth;
        }
    }, [trackWidth, min, max, value, offset, isPressed]);

    const updateValue = (x: number) => {
        'worklet';
        const percent = Math.max(0, Math.min(1, x / trackWidth));
        const rawValue = min + percent * (max - min);
        const steppedValue = Math.round(rawValue / step) * step;

        // Only call onChange if value actually changed (discrete steps)
        if (steppedValue !== value) {
            runOnJS(haptics.selection)();
            runOnJS(onChange)(steppedValue);
        }
    };

    const gesture = Gesture.Pan()
        .onBegin(() => {
            isPressed.value = true;
        })
        .onUpdate((e) => {
            const newX = Math.max(0, Math.min(trackWidth, e.x));
            offset.value = newX;
            updateValue(newX);
        })
        .onFinalize(() => {
            isPressed.value = false;
            // Snap to exact step position
            const percent = (value - min) / (max - min);
            offset.value = withSpring(percent * trackWidth, { damping: 20, stiffness: 200 });
        });

    const tapGesture = Gesture.Tap()
        .onBegin(() => {
            isPressed.value = true;
        })
        .onEnd((e) => {
            const newX = Math.max(0, Math.min(trackWidth, e.x));
            offset.value = withSpring(newX);
            updateValue(newX);
        })
        .onFinalize(() => {
            isPressed.value = false;
        });

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value - thumbSize / 2 }, { scale: withSpring(isPressed.value ? 1.2 : 1) }],
    }));

    const fillStyle = useAnimatedStyle(() => ({
        width: offset.value,
    }));

    return (
        <View style={styles.container}>
            {label && (
                <View style={styles.labelRow}>
                    <View style={styles.labelLeft}>
                        {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
                        <Text variant='caption' weight='medium' color={t.colors.textSecondary}>
                            {label}
                        </Text>
                    </View>
                    <Text variant='body' weight='bold' color={activeAccent}>
                        {renderValue ? renderValue(value) : value}
                    </Text>
                </View>
            )}

            <GestureDetector gesture={Gesture.Race(gesture, tapGesture)}>
                <View style={[styles.gestureArea, { height: scale(40) }]}>
                    <View
                        style={[
                            styles.track,
                            { height: trackHeight, borderRadius: trackHeight / 2, backgroundColor: t.colors.surface },
                        ]}
                        onLayout={onLayout}
                    >
                        <Animated.View
                            style={[
                                styles.fill,
                                { borderRadius: trackHeight / 2, backgroundColor: activeAccent },
                                fillStyle,
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.thumb,
                                {
                                    width: thumbSize,
                                    height: thumbSize,
                                    borderRadius: thumbSize / 2,
                                    top: -(thumbSize - trackHeight) / 2,
                                    backgroundColor: '#fff',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 3,
                                    elevation: 4,
                                },
                                thumbStyle,
                            ]}
                        />
                    </View>
                </View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 16, // Account for thumb scale-up (1.2x of 24px)
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    labelLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 8,
    },
    gestureArea: {
        justifyContent: 'center',
        width: '100%',
    },
    track: {
        width: '100%',
        position: 'relative',
        overflow: 'visible',
    },
    fill: {
        height: '100%',
        position: 'absolute',
        left: 0,
    },
    thumb: {
        position: 'absolute',
        left: 0,
    },
});
