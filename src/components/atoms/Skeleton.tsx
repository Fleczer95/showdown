import React, { useMemo } from 'react';
import { View, StyleSheet, type DimensionValue } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';

export type SkeletonVariant = 'text' | 'circle' | 'card' | 'rect';

export interface SkeletonProps {
    variant?: SkeletonVariant;
    width?: DimensionValue;
    height?: DimensionValue;
    /** Override border radius */
    borderRadius?: number;
    style?: View['props']['style'];
    testID?: string;
}

function Skeleton({ variant = 'text', width, height, borderRadius, style, testID }: SkeletonProps) {
    const t = useTheme();
    const opacity = useSharedValue(0.3);

    React.useEffect(() => {
        opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const dimensions = useMemo((): { w: DimensionValue; h: DimensionValue; r: number } => {
        switch (variant) {
            case 'text':
                return { w: width ?? '100%', h: height ?? t.typography.lineHeight.md, r: 4 };
            case 'circle':
                return { w: width ?? 44, h: height ?? 44, r: 9999 };
            case 'card':
                return { w: width ?? '100%', h: height ?? 120, r: t.radii.lg };
            case 'rect':
                return { w: width ?? '100%', h: height ?? 16, r: t.radii.sm };
        }
    }, [variant, width, height, t.typography.lineHeight.md, t.radii.lg, t.radii.sm]);

    return (
        <Animated.View
            style={[
                styles.base,
                {
                    backgroundColor: t.colors.borderLight,
                    width: dimensions.w,
                    height: dimensions.h,
                    borderRadius: borderRadius ?? dimensions.r,
                },
                animatedStyle,
                style,
            ]}
            testID={testID}
            accessibilityRole='none'
            importantForAccessibility='no'
        />
    );
}

const styles = StyleSheet.create({
    base: {
        overflow: 'hidden',
    },
});

export default React.memo(Skeleton);
