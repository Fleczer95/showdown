import React, { useMemo } from 'react';
import { Text as RNText, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { useTheme, type TypographyToken, type FontWeight, type FontSizeToken, type ColorToken } from '../../theme';

export type TextVariant = 'display' | 'heading' | 'subheading' | 'body' | 'caption' | 'overline';

export interface TextProps {
    variant?: TextVariant;
    color?: ColorToken | string;
    align?: 'left' | 'center' | 'right';
    weight?: FontWeight;
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
    selectable?: boolean;
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
    /** Shrink font to fit numberOfLines (requires numberOfLines) */
    adjustsFontSizeToFit?: boolean;
    testID?: string;
    accessibilityLabel?: string;
}

const variantMap: Record<TextVariant, TypographyToken> = {
    display: 'display',
    heading: 'xxl',
    subheading: 'xl',
    body: 'md',
    caption: 'sm',
    overline: 'xs',
};

const weightMap: Record<FontWeight, TextStyle['fontWeight']> = {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
};

function Text({
    variant = 'body',
    color,
    align = 'left',
    weight = 'normal',
    style,
    children,
    numberOfLines,
    ellipsizeMode,
    selectable,
    textDecorationLine,
    adjustsFontSizeToFit,
    testID,
    accessibilityLabel,
}: TextProps) {
    const t = useTheme();
    const token = variantMap[variant] as FontSizeToken;
    const fontSize: number = t.typography[token];
    const lineHeight: number = t.typography.lineHeight[token];
    const fontKey =
        weight === 'bold' ? 'bold' : weight === 'semibold' ? 'semibold' : weight === 'medium' ? 'medium' : 'regular';
    const fontFamily = t.typography.fontFamily?.[fontKey];

    const textStyle = useMemo(
        () => [
            styles.base,
            {
                fontSize,
                lineHeight,
                color: color ? (color in t.colors ? t.colors[color as ColorToken] : color) : t.colors.text,
                fontWeight: weightMap[weight],
                textAlign: align,
                letterSpacing: variant === 'overline' ? (t.typography.letterSpacing.overline ?? 1.2) : 0,
                ...(fontFamily ? { fontFamily } : {}),
                ...(textDecorationLine ? { textDecorationLine } : {}),
            },
            style,
        ],
        [
            fontSize,
            lineHeight,
            color,
            weight,
            align,
            variant,
            fontFamily,
            t.colors,
            t.typography.letterSpacing.overline,
            textDecorationLine,
            style,
        ],
    );

    return (
        <RNText
            style={textStyle}
            numberOfLines={numberOfLines}
            ellipsizeMode={ellipsizeMode}
            selectable={selectable}
            adjustsFontSizeToFit={adjustsFontSizeToFit}
            testID={testID}
            accessibilityLabel={accessibilityLabel}
            maxFontSizeMultiplier={1.5}
        >
            {children}
        </RNText>
    );
}

const styles = StyleSheet.create({
    base: {
        includeFontPadding: false,
    },
});

export default React.memo(Text);
