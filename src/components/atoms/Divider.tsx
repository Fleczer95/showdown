import React, { useMemo } from 'react';
import { View, StyleSheet, type DimensionValue } from 'react-native';
import Text from './Text';
import { useTheme, type ColorToken } from '../../theme';
import { useResponsive } from '../../responsive/useResponsive';

export interface DividerProps {
    direction?: 'horizontal' | 'vertical';
    color?: ColorToken | string;
    thickness?: number;
    length?: DimensionValue;
    /** Centered label text (horizontal only) — renders "── label ──" pattern */
    label?: string;
    /** Vertical margin for spacing */
    marginVertical?: number;
    style?: View['props']['style'];
    testID?: string;
}

function Divider({
    direction = 'horizontal',
    color,
    thickness = 1,
    length,
    label,
    marginVertical,
    style,
    testID,
}: DividerProps) {
    const t = useTheme();
    const { scale } = useResponsive();

    const lineStyle = useMemo(
        () =>
            ({
                backgroundColor: color
                    ? color in t.colors
                        ? t.colors[color as ColorToken]
                        : color
                    : t.colors.borderLight,
                ...(direction === 'horizontal'
                    ? {
                          height: thickness,
                          ...(label ? { flex: 1 } : { width: '100%' }),
                      }
                    : {
                          width: thickness,
                          height: length ?? '100%',
                      }),
            }) as View['props']['style'],
        [color, direction, thickness, length, t.colors, label],
    );

    // Label only supported for horizontal dividers
    if (label && direction === 'horizontal') {
        return (
            <View style={styles.labeledRow} testID={testID} importantForAccessibility='no-hide-descendants'>
                <View style={lineStyle} />
                <Text variant='caption' color={t.colors.textSecondary} style={{ paddingHorizontal: scale(12) }}>
                    {label}
                </Text>
                <View style={lineStyle} />
            </View>
        );
    }

    return (
        <View
            style={[
                lineStyle,
                length ? { width: length, flex: undefined } : undefined,
                marginVertical != null ? { marginVertical: marginVertical } : undefined,
                style,
            ]}
            testID={testID}
            importantForAccessibility='no-hide-descendants'
        />
    );
}

const styles = StyleSheet.create({
    labeledRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
});

export default React.memo(Divider);
