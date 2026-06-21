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

const Bar = ({ w, color, h = 7 }: { w: DimensionValue; color: string; h?: number }) => {
    const { scale } = useResponsive();
    return <View style={{ width: w, height: scale(h), borderRadius: scale(h) / 2, backgroundColor: color }} />;
};

const MockCard = ({ colors }: { colors: ThemeColors }) => {
    const { scale } = useResponsive();
    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight, borderRadius: scale(14), padding: scale(10), marginBottom: scale(10) }]}>
            <View style={[styles.cardDot, { backgroundColor: colors.primary, width: scale(18), height: scale(18), borderRadius: scale(9), marginRight: scale(10) }]} />
            <View style={styles.cardBody}>
                <Bar w='70%' color={colors.text} />
                <View style={{ height: scale(5) }} />
                <Bar w='90%' color={colors.textSecondary} h={5} />
            </View>
            <View style={[styles.cardBadge, { backgroundColor: colors.primary + '33', width: scale(22), height: scale(10), borderRadius: scale(5), marginLeft: scale(8) }]} />
        </View>
    );
};

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

            <View style={[styles.content, { padding: scale(16) }]} pointerEvents='none'>
                {/* Header */}
                <View style={styles.header}>
                    <View style={[styles.headerIcon, { backgroundColor: colors.primary, width: scale(26), height: scale(26), borderRadius: scale(8), marginRight: scale(10) }]} />
                    <View style={styles.headerText}>
                        <Bar w='80%' color={colors.text} h={9} />
                        <View style={{ height: scale(5) }} />
                        <Bar w='55%' color={colors.textMuted} h={5} />
                    </View>
                </View>

                {/* Section label */}
                <View style={{ height: scale(14) }} />
                <Bar w='40%' color={colors.textMuted} h={5} />
                <View style={{ height: scale(10) }} />

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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIcon: {
    },
    headerText: {
        flex: 1,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    cardDot: {
    },
    cardBody: {
        flex: 1,
    },
    cardBadge: {
    },
});
