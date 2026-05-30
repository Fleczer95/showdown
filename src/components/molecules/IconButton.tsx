import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Pressable from '../atoms/HapticPressable';
import { useTheme } from '../../theme';
import type { ColorToken } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
    icon: React.ReactNode;
    size?: IconButtonSize;
    onPress?: () => void;
    disabled?: boolean;
    haptic?: 'light' | 'medium' | 'heavy';
    bgColor?: ColorToken | string;
    testID?: string;
    accessibilityLabel: string;
    hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}

const sizeMap = { sm: 32, md: 44, lg: 56 };

function IconButton({
    icon,
    size = 'md',
    onPress,
    disabled,
    haptic = 'light',
    bgColor,
    testID,
    accessibilityLabel,
    hitSlop,
}: IconButtonProps) {
    const t = useTheme();
    const { scale } = useResponsive();
    // Fluid: grows continuously toward tablet instead of a discrete breakpoint jump.
    const dimension = scale(sizeMap[size]);

    const containerStyle = useMemo(
        () => [
            styles.base,
            {
                width: dimension,
                height: dimension,
                borderRadius: t.radii.md,
                backgroundColor: bgColor ?? 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
            },
        ],
        [dimension, t.radii.md, bgColor],
    );

    return (
        <Pressable
            style={containerStyle}
            onPress={onPress}
            haptic={haptic}
            disabled={disabled}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole='button'
            hitSlop={hitSlop ?? { top: 12, bottom: 12, left: 12, right: 12 }}
        >
            <View pointerEvents='none'>{icon}</View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {},
});

export default React.memo(IconButton);
