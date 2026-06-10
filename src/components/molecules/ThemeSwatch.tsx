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

const Bar = ({ w, color, h = 4 }: { w: DimensionValue; color: string; h?: number }) => (
    <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }} />
);

/** A single Home-style game card: accent medallion · two text lines · CTA pill. */
const GameRow = ({ colors, accent, lines }: { colors: ThemeColors; accent: string; lines: 1 | 2 }) => (
    <View style={[styles.mockCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <View style={[styles.mockMedallion, { backgroundColor: accent }]} />
        <View style={styles.mockCardBody}>
            <Bar w='75%' color={colors.text} h={3} />
            {lines === 2 ? (
                <>
                    <View style={{ height: 3 }} />
                    <Bar w='50%' color={colors.textSecondary} h={3} />
                </>
            ) : null}
        </View>
        <View style={[styles.mockCta, { backgroundColor: accent + '2E' }]} />
    </View>
);

/**
 * A miniature of the Home screen painted in the theme's own colors: the
 * wordmark + header icons, the level bar (chip + progress pips), then two game
 * cards — so a swatch reads as "what the app looks like" in that theme.
 */
const MiniMockup = ({ colors }: { colors: ThemeColors }) => (
    <View style={styles.mockup}>
        {/* Header: wordmark + two icon buttons */}
        <View style={styles.mockHeader}>
            <Bar w='42%' color={colors.primary} h={7} />
            <View style={styles.mockHeaderIcons}>
                <View style={[styles.mockIconDot, { backgroundColor: colors.textMuted }]} />
                <View style={[styles.mockIconDot, { backgroundColor: colors.textMuted }]} />
            </View>
        </View>

        {/* Level bar: chip + progress pips */}
        <View
            style={[
                styles.mockLevelBar,
                { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '2E' },
            ]}
        >
            <View style={[styles.mockLevelChip, { backgroundColor: colors.primary }]} />
            <View style={styles.mockPips}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <View
                        key={i}
                        style={[styles.mockPip, { backgroundColor: i < 3 ? colors.primary : colors.borderLight }]}
                    />
                ))}
            </View>
        </View>

        {/* Game cards */}
        <GameRow colors={colors} accent={colors.primary} lines={2} />
        <GameRow colors={colors} accent={colors.secondary} lines={1} />
    </View>
);

function ThemeSwatch({ tokens, label, selected, locked, lockLabel, onPress, testID }: ThemeSwatchProps) {
    const theme = useTheme();
    const { breakpoint, iconSize } = useResponsive();

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
                },
            ]}
        >
            <View
                pointerEvents='none'
                style={[styles.preview, { backgroundColor: colors.background, borderRadius: theme.radii.md }]}
            >
                <View style={[StyleSheet.absoluteFill, locked && styles.dim]}>
                    <MiniMockup colors={colors} />
                </View>

                {selected && (
                    <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                        <Check size={iconSize(13)} color={theme.colors.onPrimary} strokeWidth={3} />
                    </View>
                )}

                {locked && (
                    <View style={styles.lockOverlay}>
                        <View style={[styles.lockPill, { backgroundColor: theme.colors.overlay + 'CC' }]}>
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
        padding: 6,
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
        padding: 7,
        gap: 6,
    },
    mockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mockHeaderIcons: {
        flexDirection: 'row',
        gap: 3,
    },
    mockIconDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    mockLevelBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 4,
        paddingVertical: 3,
    },
    mockLevelChip: {
        width: 12,
        height: 6,
        borderRadius: 3,
    },
    mockPips: {
        flex: 1,
        flexDirection: 'row',
        gap: 2,
    },
    mockPip: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    mockCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 7,
        padding: 5,
    },
    mockMedallion: {
        width: 14,
        height: 14,
        borderRadius: 5,
    },
    mockCardBody: {
        flex: 1,
    },
    mockCta: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 18,
        height: 18,
        borderRadius: 9,
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
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    label: {
        width: '100%',
    },
});

export default React.memo(ThemeSwatch);
