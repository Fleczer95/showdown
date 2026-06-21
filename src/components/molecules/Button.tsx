import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Pressable from '../atoms/HapticPressable';
import Text from '../atoms/Text';
import ActivityIndicator from '../atoms/ActivityIndicator';
import Stack from '../atoms/Stack';
import { useTheme } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    haptic?: 'light' | 'medium' | 'heavy' | 'none';
    onPress?: () => void;
    children?: React.ReactNode;
    fullWidth?: boolean;
    /** Icon element placed before or after text */
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    testID?: string;
    accessibilityLabel?: string;
    style?: View['props']['style'];
    textColor?: string;
}

const sizePadding = {
    sm: { vertical: 'xs' as const, horizontal: 'md' as const },
    md: { vertical: 'sm' as const, horizontal: 'lg' as const },
    lg: { vertical: 'md' as const, horizontal: 'xl' as const },
};

const sizeFontVariant: Record<string, 'body' | 'subheading'> = {
    sm: 'body',
    md: 'body',
    lg: 'subheading',
};

function Button({
    variant = 'primary',
    size = 'md',
    disabled,
    loading,
    haptic = 'medium',
    onPress,
    children,
    fullWidth,
    icon,
    iconPosition = 'left',
    testID,
    accessibilityLabel,
    style,
    textColor,
}: ButtonProps) {
    const t = useTheme();
    const v = t.components.button[variant] || t.components.button.primary;
    const padding = sizePadding[size];
    const isDisabled = disabled || loading;

    const containerStyle = useMemo(
        () => [
            styles.base,
            {
                backgroundColor: isDisabled ? t.colors.surfaceVariant : v.bg,
                borderColor: isDisabled ? t.colors.border : v.border,
                paddingVertical: t.spacing[padding.vertical],
                paddingHorizontal: t.spacing[padding.horizontal],
                borderRadius: t.radii.md,
                minWidth: 44,
                minHeight: 44,
                ...(fullWidth ? { width: '100%' } : {}),
                ...t.shadows.md,
            },
            style,
        ],
        [isDisabled, v.bg, v.border, t.spacing, t.radii.md, t.colors, padding, fullWidth, style],
    );

    return (
        <Pressable
            style={containerStyle as View['props']['style']}
            onPress={onPress}
            haptic={haptic}
            disabled={isDisabled}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={loading ? { busy: true } : disabled ? { disabled: true } : undefined}
        >
            {loading ? (
                <View pointerEvents='none'>
                    <ActivityIndicator size={size === 'lg' ? 'md' : 'sm'} color={textColor || v.text} />
                </View>
            ) : icon || children ? (
                <Stack
                    direction='horizontal'
                    gap='xs'
                    align='center'
                    justify='center'
                    style={styles.content}
                    pointerEvents='none'
                >
                    {icon && iconPosition === 'left' ? icon : null}
                    {children ? (
                        <Text
                            variant={sizeFontVariant[size]}
                            color={textColor || v.text}
                            weight='semibold'
                            align='center'
                            style={styles.label}
                            numberOfLines={1}
                        >
                            {children}
                        </Text>
                    ) : null}
                    {icon && iconPosition === 'right' ? icon : null}
                </Stack>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        maxWidth: '100%',
    },
    label: {
        flexShrink: 1,
        minWidth: 0,
    },
});

export default React.memo(Button);
