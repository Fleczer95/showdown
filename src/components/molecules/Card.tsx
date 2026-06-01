import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Pressable from '../atoms/HapticPressable';
import { useTheme } from '../../theme';

export type CardVariant = 'elevated' | 'outlined' | 'flat' | 'glass';

export interface CardProps {
    variant?: CardVariant;
    padding?: 'sm' | 'md' | 'lg' | 'none';
    /** Gap between children */
    gap?: 'sm' | 'md' | 'lg';
    style?: View['props']['style'];
    children?: React.ReactNode;
    testID?: string;
    accessibilityLabel?: string;
    /** Make the card tappable */
    onPress?: () => void;
    disabled?: boolean;
    haptic?: 'light' | 'medium' | 'heavy';
}

function Card({
    variant = 'elevated',
    padding = 'md',
    gap,
    style,
    children,
    testID,
    accessibilityLabel,
    onPress,
    disabled,
    haptic,
}: CardProps) {
    const t = useTheme();
    const v = t.components.card[variant] || t.components.card.elevated;
    const shadowStyle = v.shadow !== 'none' ? t.shadows[v.shadow] : null;

    const containerStyle = useMemo(
        () => [
            styles.base,
            {
                backgroundColor: v.bg,
                borderColor: v.border,
                borderRadius: t.radii.lg,
                ...(padding !== 'none' ? { padding: t.spacing[padding] } : {}),
                ...(gap ? { gap: t.spacing[gap] } : {}),
                // 3D effect for glass variant
                ...(variant === 'glass' ? {
                    borderBottomWidth: 5,
                    borderBottomColor: t.colors.shadow,
                    borderTopColor: t.colors.glassBorder,
                    borderLeftColor: t.colors.glassBorder,
                    borderRightColor: t.colors.glassBorder,
                } : {}),
            },
            shadowStyle,
            style,
        ],
        [v.bg, v.border, t.radii.lg, t.spacing, padding, gap, shadowStyle, style],
    );

    const Wrapper = onPress ? Pressable : View;

    return (
        <Wrapper
            style={containerStyle}
            testID={testID}
            {...(accessibilityLabel ? { accessible: true, accessibilityLabel } : {})}
            {...(onPress ? { onPress, disabled, haptic } : {})}
        >
            {children}
        </Wrapper>
    );
}

const styles = StyleSheet.create({
    base: {
        borderWidth: 1,
    },
});

export default React.memo(Card);
