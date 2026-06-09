import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { Group, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';
import {
    useSharedValue,
    withRepeat,
    withTiming,
    useDerivedValue,
    cancelAnimation,
    Easing,
} from 'react-native-reanimated';
import { useTheme } from '../context';
import type { ThemeColors } from '../contract';

interface WaveEffectProps {
    /** Override the canvas size (defaults to the full window). Used by previews. */
    width?: number;
    height?: number;
    /** Override the wave colors (defaults to the active theme). */
    colors?: ThemeColors;
}

export const WaveEffect = ({ width: widthProp, height: heightProp, colors: colorsProp }: WaveEffectProps = {}) => {
    const window = useWindowDimensions();
    const width = widthProp ?? window.width;
    const height = heightProp ?? window.height;
    const t = useTheme();
    const colors = colorsProp ?? t.colors;
    const time = useSharedValue(0);

    useEffect(() => {
        // Very slow, calm animation
        time.value = withRepeat(withTiming(1, { duration: 25000, easing: Easing.linear }), -1, false);
        return () => cancelAnimation(time);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const createWavePath = (tValue: number, amplitude: number, frequency: number, phase: number, yOffset: number) => {
        'worklet';
        const path = Skia.Path.Make();
        const points = 30; // Increased points for sharpness
        const step = width / (points - 1);

        path.moveTo(0, height);
        path.lineTo(0, yOffset);

        for (let i = 0; i < points; i++) {
            const x = i * step;
            // Compound wave for more organic, calm motion
            const mainWave = Math.sin(i * frequency + phase + tValue * Math.PI * 2);
            const subWave = Math.sin(i * frequency * 2.1 + phase * 1.5 - tValue * Math.PI * 1.2) * 0.3;
            const y = yOffset + (mainWave + subWave) * amplitude;

            path.lineTo(x, y);
        }

        path.lineTo(width, height);
        path.close();
        return path;
    };

    // Deep, calm wave layers positioned at the bottom
    const path1 = useDerivedValue(() => createWavePath(time.value, 12, 0.35, 0, height * 0.85));
    const path2 = useDerivedValue(() => createWavePath(time.value * 0.6, 18, 0.25, Math.PI / 2, height * 0.88));
    const path3 = useDerivedValue(() => createWavePath(time.value * 0.8, 15, 0.3, Math.PI, height * 0.9));

    return (
        <Group>
            {/* Layer 1 - Deepest */}
            <Path path={path1}>
                <LinearGradient
                    start={vec(0, height * 0.8)}
                    end={vec(0, height)}
                    colors={[colors.surfaceVariant, colors.background]}
                />
            </Path>

            {/* Layer 2 - Middle */}
            <Path path={path2} opacity={0.6}>
                <LinearGradient
                    start={vec(0, height * 0.85)}
                    end={vec(0, height)}
                    colors={[colors.secondary, colors.surface]}
                />
            </Path>

            {/* Layer 3 - Top / Foreground */}
            <Path path={path3} opacity={0.5}>
                <LinearGradient
                    start={vec(0, height * 0.9)}
                    end={vec(0, height)}
                    colors={[colors.primary, colors.surfaceVariant]}
                />
            </Path>
        </Group>
    );
};
