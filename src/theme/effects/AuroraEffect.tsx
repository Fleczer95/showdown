import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Group, LinearGradient, vec, Rect, BlurMask } from '@shopify/react-native-skia';
import {
    useSharedValue,
    withRepeat,
    withTiming,
    useDerivedValue,
    cancelAnimation,
    Easing,
} from 'react-native-reanimated';
import { useTheme } from '../context';

export const AuroraEffect = () => {
    const { width, height } = useWindowDimensions();
    const t = useTheme();

    const time = useSharedValue(0);

    React.useEffect(() => {
        time.value = withRepeat(withTiming(1, { duration: 15000, easing: Easing.inOut(Easing.sin) }), -1, true);
        return () => cancelAnimation(time);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const p1 = useDerivedValue(() => {
        return vec(width * (0.2 + time.value * 0.1), height * (0.1 + Math.sin(time.value * Math.PI) * 0.05));
    });

    const p2 = useDerivedValue(() => {
        return vec(width * (0.8 - time.value * 0.1), height * (0.9 - Math.cos(time.value * Math.PI) * 0.05));
    });

    return (
        <Group opacity={0.3}>
            <Rect x={0} y={0} width={width} height={height}>
                <LinearGradient start={p1} end={p2} colors={[t.colors.primary, t.colors.secondary, 'transparent']} />
                <BlurMask blur={50} style='normal' />
            </Rect>
        </Group>
    );
};
