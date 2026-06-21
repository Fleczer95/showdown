import React, { useMemo } from 'react';
import { View, StyleSheet, type DimensionValue } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import Pressable from '../atoms/HapticPressable';
import Text from '../atoms/Text';
import { useTheme } from '../../theme';
import { resolveTheme } from '../../theme/resolveTheme';
import { useResponsive } from '../../responsive/useResponsive';
import type { Theme, ThemeColors } from '../../theme/contract';

export interface ThemeSwatchProps {
    /** Raw theme tokens — resolved internally so the swatch shows real colors. */
    tokens: Theme;
    label: string;
    selected: boolean;
    locked?: boolean;
    /** Short hint on a locked tile, e.g. the level that unlocks it. */
    lockLabel?: string;
    onPress: () => void;
    testID?: string;
}

const Bar = ({ w, color, h = 4, scale }: { w: DimensionValue; color: string; h?: number; scale: (v: number) => number }) => (
    <View style={{ width: w, height: scale(h), borderRadius: scale(h) / 2, backgroundColor: color }} />
);

/** A single Home-style game card: accent medallion · two text lines · CTA pill. */
const GameRow = ({ colors, accent, lines, scale }: { colors: ThemeColors; accent: string; lines: 1 | 2; scale: (v: number) => number }) => (
    <View style={[styles.mockCard, { backgroundColor: colors.surface, borderColor: colors.borderLight, borderRadius: scale(7), padding: scale(5), gap: scale(5) }]}>
        <View style={[{ backgroundColor: accent, width: scale(14), height: scale(14), borderRadius: scale(5) }]} />
        <View style={styles.mockCardBody}>
            <Bar w='75%' color={colors.text} h={3} scale={scale} />
            {lines === 2 ? (
                <>
                    <View style={{ height: scale(3) }} />
                    <Bar w='50%' color={colors.textSecondary} h={3} scale={scale} />
                </>
            ) : null}
        </View>
        <View style={[{ backgroundColor: accent + '2E', width: scale(9), height: scale(9), borderRadius: scale(4.5) }]} />
    </View>
);

/**
 * A miniature of the Home screen painted in the theme's own colors: the
 * wordmark + header icons, the level bar (chip + progress pips), then two game
 * cards — so a swatch reads as "what the app looks like" in that theme.
 */
const MiniMockup = ({ colors, scale }: { colors: ThemeColors; scale: (v: number) => number }) => (
    <View style={[styles.mockup, { padding: scale(7), gap: scale(6) }]}>
        {/* Header: wordmark + two icon buttons */}
        <View style={styles.mockHeader}>
            <Bar w='42%' color={colors.primary} h={7} scale={scale} />
            <View style={[styles.mockHeaderIcons, { gap: scale(3) }]}>
                <View style={[{ backgroundColor: colors.textMuted, width: scale(5), height: scale(5), borderRadius: scale(2.5) }]} />
                <View style={[{ backgroundColor: colors.textMuted, width: scale(5), height: scale(5), borderRadius: scale(2.5) }]} />
            </View>
        </View>

        {/* Level bar: chip + progress pips */}
        <View
            style={[
                styles.mockLevelBar,
                { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '2E', gap: scale(4), paddingHorizontal: scale(4), paddingVertical: scale(3) },
            ]}
        >
            <View style={[{ backgroundColor: colors.primary, width: scale(12), height: scale(6), borderRadius: scale(3) }]} />
            <View style={[styles.mockPips, { gap: scale(2) }]}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <View
                        key={i}
                        style={[{ backgroundColor: i < 3 ? colors.primary : colors.borderLight, flex: 1, height: scale(4), borderRadius: scale(2) }]}
                    />
                ))}
            </View>
        </View>

        {/* Game cards */}
        <GameRow colors={colors} accent={colors.primary} lines={2} scale={scale} />
        <GameRow colors={colors} accent={colors.secondary} lines={1} scale={scale} />
    </View>
);

function ThemeSwatch({ tokens, label, selected, locked, lockLabel, onPress, testID }: ThemeSwatchProps) {
    const theme = useTheme();
    const { breakpoint, iconSize, scale } = useResponsive();

    const colors = useMemo(() => resolveTheme(tokens, breakpoint).colors, [tokens, breakpoint]);

    return (
        <Pressable
            onPress={onPress}
            haptic='light'
            testID={testID}
            accessibilityRole='button'
            accessibilityState={{ selected, disabled: locked }}
            accessibilityLabel={label}
            style={[
                styles.tile,
                {
                    borderRadius: theme.radii.lg,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                    backgroundColor: theme.colors.surface,
                    padding: scale(6),
                },
            ]}
        >
            <View
                pointerEvents='none'
                style={[styles.preview, { backgroundColor: colors.background, borderRadius: theme.radii.md }]}
            >
                <View style={[StyleSheet.absoluteFill, locked && styles.dim]}>
                    <MiniMockup colors={colors} scale={scale} />
                </View>

                {selected && (
                    <View style={[styles.badge, { backgroundColor: theme.colors.primary, top: scale(4), right: scale(4), width: scale(18), height: scale(18), borderRadius: scale(9) }]}>
                        <Check size={iconSize(13)} color={theme.colors.onPrimary} strokeWidth={3} />
                    </View>
                )}

                {locked && (
                    <View style={styles.lockOverlay}>
                        <View style={[styles.lockPill, { backgroundColor: theme.colors.overlay + 'CC', gap: scale(4), paddingHorizontal: scale(8), paddingVertical: scale(4) }]}>
                            <Lock size={iconSize(12)} color='#FFFFFF' />
                            {lockLabel ? (
                                <Text variant='caption' weight='bold' color='#FFFFFF'>
                                    {lockLabel}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                )}
            </View>

            <Text
                variant='caption'
                weight={selected ? 'bold' : 'semibold'}
                color={selected ? theme.colors.primary : theme.colors.text}
                numberOfLines={1}
                align='center'
                style={[styles.label, { marginTop: theme.spacing.sm }]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    tile: {
        flex: 1,
    },
    preview: {
        width: '100%',
        aspectRatio: 0.82,
        overflow: 'hidden',
    },
    dim: {
        opacity: 0.45,
    },
    mockup: {
        flex: 1,
    },
    mockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mockHeaderIcons: {
        flexDirection: 'row',
    },
    mockLevelBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    mockPips: {
        flex: 1,
        flexDirection: 'row',
    },
    mockCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    mockCardBody: {
        flex: 1,
    },
    badge: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
    },
    label: {
        width: '100%',
    },
});

export default React.memo(ThemeSwatch);
