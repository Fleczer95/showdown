import React, { useMemo } from 'react';
import { View, StyleSheet, type FlexAlignType } from 'react-native';
import { useSpacing } from '../../theme';

type StackDirection = 'vertical' | 'horizontal';
type StackAlign = 'start' | 'center' | 'end' | 'stretch';
type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface StackProps {
    direction?: StackDirection;
    gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | number;
    align?: StackAlign;
    justify?: StackJustify;
    flex?: number;
    /** Enable flex wrapping for tag/chip layouts */
    wrap?: boolean;
    style?: View['props']['style'];
    pointerEvents?: View['props']['pointerEvents'];
    children?: React.ReactNode;
    testID?: string;
    importantForAccessibility?: View['props']['importantForAccessibility'];
}

const alignMap: Record<StackAlign, FlexAlignType> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
};

const justifyMap: Record<StackJustify, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
};

function Stack({
    direction = 'vertical',
    gap = 'md',
    align = 'stretch',
    justify = 'start',
    flex,
    wrap,
    style,
    pointerEvents,
    children,
    testID,
}: StackProps) {
    const spacing = useSpacing();
    const gapSpacing = typeof gap === 'number' ? gap : spacing[gap];

    const containerStyle = useMemo(
        () =>
            [
                styles.container,
                {
                    flexDirection: direction === 'vertical' ? 'column' : ('row' as const),
                    gap: gapSpacing,
                    alignItems: alignMap[align],
                    justifyContent: justifyMap[justify],
                    ...(flex != null ? { flex } : {}),
                    ...(wrap ? { flexWrap: 'wrap' as const } : {}),
                },
                style,
            ] as View['props']['style'],
        [direction, gapSpacing, align, justify, flex, wrap, style],
    );

    return (
        <View
            style={containerStyle as View['props']['style']}
            testID={testID}
            importantForAccessibility='no-hide-descendants'
            pointerEvents={pointerEvents}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexShrink: 1,
    },
});

export default React.memo(Stack);
