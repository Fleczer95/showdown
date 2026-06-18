import React from 'react';
import { Text as RNText, StyleSheet, type TextStyle, type StyleProp } from 'react-native';

// The single place an emoji character becomes pixels. Today it renders the glyph
// as text; the planned app-wide migration will swap these internals to an SVG
// library (codepoint -> SVG) without touching any call site. Keyed by the emoji
// character — the stable token both a text render and a codepoint-based renderer
// understand.

export interface GlyphProps {
    /** The emoji character to render (e.g. '🔥'). */
    emoji: string;
    /** Rendered size in px (font size today, SVG box later). */
    size?: number;
    style?: StyleProp<TextStyle>;
    accessibilityLabel?: string;
}

function Glyph({ emoji, size = 16, style, accessibilityLabel }: GlyphProps) {
    return (
        <RNText
            style={[styles.glyph, { fontSize: size, lineHeight: size * 1.2 }, style]}
            accessibilityLabel={accessibilityLabel}
            allowFontScaling={false}
        >
            {emoji}
        </RNText>
    );
}

const styles = StyleSheet.create({
    glyph: {
        includeFontPadding: false,
    },
});

export default React.memo(Glyph);
