import React from 'react';
import { Text as RNText, Image, StyleSheet, type TextStyle, type StyleProp } from 'react-native';
import { GLYPH_ASSETS } from './glyphAssets';

// The single place an emoji character becomes pixels. Emojis present in
// GLYPH_ASSETS render as bundled Fluent (3D) art; anything else falls back to the
// OS text glyph. Keyed by the emoji character — the stable token every call site
// passes, and the key both the asset map and the text fallback understand.

export interface GlyphProps {
    /** The emoji character to render (e.g. '🔥'). */
    emoji: string;
    /** Rendered size in px (the art's box, or font size for the text fallback). */
    size?: number;
    style?: StyleProp<TextStyle>;
    accessibilityLabel?: string;
}

function Glyph({ emoji, size = 16, style, accessibilityLabel }: GlyphProps) {
    const asset = GLYPH_ASSETS[emoji];
    if (asset) {
        return (
            <Image
                source={asset}
                style={{ width: size, height: size }}
                accessibilityLabel={accessibilityLabel}
                accessible={!!accessibilityLabel}
            />
        );
    }
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
