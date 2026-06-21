import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Text from './Text';
import Stack from './Stack';
import { useTheme } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'error' | 'warning';

export interface BadgeProps {
    variant?: BadgeVariant;
    style?: View['props']['style'];
    children?: React.ReactNode;
    /** Optional icon rendered before text */
    icon?: React.ReactNode;
    /** Show as a small dot (no content) */
    dot?: boolean;
    /** Badge size preset */
    size?: 'sm' | 'md';
    /** Show border for outlined style */
    bordered?: boolean;
    testID?: string;
}

function Badge({
    variant = 'default',
    style,
    children,
    icon,
    dot = false,
    size = 'md',
    bordered = false,
    testID,
}: BadgeProps) {
    const t = useTheme();
    const { scale } = useResponsive();
    const v = t.components.badge[variant] || t.components.badge.default;

    const containerStyle = useMemo(
        () => [
            styles.base,
            {
                backgroundColor: v.bg,
                ...(bordered ? { borderWidth: 1, borderColor: v.text } : {}),
                ...(dot
                    ? {
                          width: t.spacing.sm,
                          height: t.spacing.sm,
                          minWidth: t.spacing.sm,
                          minHeight: t.spacing.sm,
                          padding: 0,
                      }
                    : size === 'sm'
                      ? { paddingHorizontal: t.spacing.xs, paddingVertical: scale(2), fontSize: t.typography.xs }
                      : { paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs }),
                borderRadius: t.radii.full,
            },
            style,
        ],
        [v.bg, v.text, t.spacing.sm, t.spacing.xs, t.radii.full, dot, size, bordered, t.typography.xs, style, scale],
    );

    if (dot) return <View style={containerStyle} testID={testID} accessibilityRole='text' />;

    return (
        <View style={containerStyle} testID={testID} accessibilityRole='text'>
            {icon || children ? (
                <Stack direction='horizontal' gap='xs' align='center'>
                    {icon}
                    {children ? (
                        <Text
                            variant='overline'
                            color={v.text}
                            weight='semibold'
                            style={{ letterSpacing: 0.3 }}
                            testID='badge-text'
                        >
                            {children}
                        </Text>
                    ) : null}
                </Stack>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        alignSelf: 'flex-start',
    },
});

export default React.memo(Badge);
