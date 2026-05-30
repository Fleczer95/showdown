import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { BlurMask, Group, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import {
    useSharedValue,
    withRepeat,
    withTiming,
    useDerivedValue,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../context';

export const DefaultGlowEffect = () => {
    const { width, height } = useWindowDimensions();
    const t = useTheme();

    // Reanimated shared values for movement
    const time = useSharedValue(0);
    const pulse = useSharedValue(0);

    useEffect(() => {
        time.value = withRepeat(withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.sin) }), -1, true);
        pulse.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.quad) }), -1, true);
        return () => {
            cancelAnimation(time);
            cancelAnimation(pulse);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Dynamic focal points for the gradients
    const p1 = useDerivedValue(() => {
        const x = width * (0.1 + time.value * 0.2);
        const y = height * (0.1 + Math.sin(time.value * Math.PI) * 0.1);
        return vec(x, y);
    });

    const p2 = useDerivedValue(() => {
        const x = width * (0.9 - time.value * 0.3);
        const y = height * (0.9 - Math.cos(time.value * Math.PI) * 0.2);
        return vec(x, y);
    });

    const p3 = useDerivedValue(() => {
        const x = width * (0.5 + Math.sin(pulse.value * Math.PI) * 0.2);
        const y = height * (0.4 + Math.cos(pulse.value * Math.PI) * 0.2);
        return vec(x, y);
    });

    return (
        <Group opacity={0.15}>
            {/* Top Right Glow */}
            <Rect x={0} y={0} width={width} height={height}>
                <LinearGradient start={p1} end={vec(width, height * 0.5)} colors={[t.colors.primary, 'transparent']} />
                <BlurMask blur={80} style='normal' />
            </Rect>

            {/* Bottom Left Glow */}
            <Rect x={0} y={0} width={width} height={height}>
                <LinearGradient start={p2} end={vec(0, height * 0.5)} colors={[t.colors.secondary, 'transparent']} />
                <BlurMask blur={100} style='normal' />
            </Rect>

            {/* Floating Central Glow */}
            <Rect x={0} y={0} width={width} height={height}>
                <LinearGradient start={p3} end={vec(width * 0.5, height)} colors={['#C084FC', 'transparent']} />
                <BlurMask blur={120} style='normal' />
            </Rect>
        </Group>
    );
};
