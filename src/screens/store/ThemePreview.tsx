import React, { useMemo } from 'react';
import { View, StyleSheet, type DimensionValue } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { resolveTheme } from '../../theme/resolveTheme';
import { LeafEffect } from '../../theme/effects/LeafEffect';
import { WaveEffect } from '../../theme/effects/WaveEffect';
import type { Theme, ThemeColors } from '../../theme/contract';
import { useResponsive } from '../../responsive/useResponsive';

/** Maps a theme key to its signature background effect (mirrors ThemeEffects). */
const LEAF_THEMES = new Set(['forest', 'nature']);
const WAVE_THEMES = new Set(['ocean']);

const Bar = ({ w, color, h = 7 }: { w: DimensionValue; color: string; h?: number }) => (
    <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }} />
);

const MockCard = ({ colors }: { colors: ThemeColors }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <View style={[styles.cardDot, { backgroundColor: colors.primary }]} />
        <View style={styles.cardBody}>
            <Bar w='70%' color={colors.text} />
            <View style={{ height: 5 }} />
            <Bar w='90%' color={colors.textSecondary} h={5} />
        </View>
        <View style={[styles.cardBadge, { backgroundColor: colors.primary + '33' }]} />
    </View>
);

/**
 * A miniature home-screen mockup rendered in the previewed theme's colors and
 * overlaid with its signature animated effect, so shoppers can see a premium
 * theme before buying.
 */
export function ThemePreview({ tokens }: { tokens: Theme }) {
    const { scale, breakpoint } = useResponsive();

    const colors = useMemo(() => resolveTheme(tokens, breakpoint).colors, [tokens, breakpoint]);

    const width = scale(170, 210);
    const height = scale(290, 360);
    const radius = scale(28, 34);

    return (
        <View
            style={[styles.frame, { width, height, borderRadius: radius, backgroundColor: colors.background, borderColor: colors.border }]}
        >
            <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents='none'>
                {LEAF_THEMES.has(tokens.id) && <LeafEffect width={width} height={height} color={colors.primary} />}
                {WAVE_THEMES.has(tokens.id) && <WaveEffect width={width} height={height} colors={colors} />}
            </Canvas>

            <View style={styles.content} pointerEvents='none'>
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.headerIcon, { backgroundColor: colors.primary }]} />
                    <View style={styles.headerText}>
                        <Bar w='80%' color={colors.text} h={9} />
                        <View style={{ height: 5 }} />
                        <Bar w='55%' color={colors.textMuted} h={5} />
                    </View>
                </View>

                {/* Section label */}
                <View style={{ height: 14 }} />
                <Bar w='40%' color={colors.textMuted} h={5} />
                <View style={{ height: 10 }} />

                <MockCard colors={colors} />
                <MockCard colors={colors} />
                <MockCard colors={colors} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        borderWidth: 1,
        overflow: 'hidden',
        alignSelf: 'center',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        marginRight: 10,
    },
    headerText: {
        flex: 1,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
        marginBottom: 10,
    },
    cardDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        marginRight: 10,
    },
    cardBody: {
        flex: 1,
    },
    cardBadge: {
        width: 22,
        height: 10,
        borderRadius: 5,
        marginLeft: 8,
    },
});
