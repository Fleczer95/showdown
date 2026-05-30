import React, { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Text from './Text';
import { useTheme, useRadii } from '../../theme';
import type { ColorToken } from '../../theme';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
    /** Image source URI or require */
    source?: Image['props']['source'];
    /** Fallback text when no source (emoji or initials) */
    label?: string;
    size?: AvatarSize;
    color?: ColorToken | string;
    bgColor?: ColorToken | string;
    /** Status indicator dot ('online' | 'offline' | 'busy' | 'away') */
    status?: 'online' | 'offline' | 'busy' | 'away';
    style?: View['props']['style'];
    testID?: string;
}

const sizeMap = { sm: 32, md: 44, lg: 64 };

function Avatar({ source, label, size = 'md', color, bgColor, status, style, testID }: AvatarProps) {
    const t = useTheme();
    const radii = useRadii();
    const scale = t.typography.md / 14;
    const dimension = sizeMap[size] * scale;

    const containerStyle = useMemo(
        () => [
            styles.base,
            {
                width: dimension,
                height: dimension,
                borderRadius: radii.full,
                backgroundColor: bgColor
                    ? bgColor in t.colors
                        ? t.colors[bgColor as ColorToken]
                        : bgColor
                    : t.colors.surfaceVariant,
            },
            style,
        ],
        [dimension, radii.full, bgColor, t.colors, style],
    );

    const textVariant = size === 'sm' ? ('caption' as const) : size === 'md' ? ('caption' as const) : ('body' as const);

    return (
        <View style={containerStyle} testID={testID} accessibilityRole='image' accessibilityLabel={label}>
            {source ? (
                <Image source={source} style={styles.image} resizeMode='cover' accessible={false} />
            ) : label ? (
                <Text variant={textVariant} color={color ?? t.colors.text} weight='semibold'>
                    {label}
                </Text>
            ) : null}
            {status ? (
                <View
                    style={[
                        styles.statusDot,
                        {
                            backgroundColor:
                                status === 'online'
                                    ? t.colors.success
                                    : status === 'busy'
                                      ? t.colors.error
                                      : status === 'away'
                                        ? t.colors.warning
                                        : t.colors.textSecondary,
                            width: dimension * 0.25,
                            height: dimension * 0.25,
                        },
                    ]}
                />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: 9999,
        borderWidth: 2,
        borderColor: 'white',
    },
});

export default React.memo(Avatar);
