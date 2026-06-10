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

const Bar = ({ w, color, h = 5 }: { w: DimensionValue; color: string; h?: number }) => (
    <View style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: color }} />
);

/** A miniature home-screen mockup painted in the theme's own colors. */
const MiniMockup = ({ colors }: { colors: ThemeColors }) => (
    <View style={styles.mockup}>
        <View style={styles.mockHeader}>
            <View style={[styles.mockHeaderIcon, { backgroundColor: colors.primary }]} />
            <View style={styles.mockHeaderText}>
                <Bar w='75%' color={colors.text} h={4} />
                <View style={{ height: 3 }} />
                <Bar w='45%' color={colors.textMuted} h={3} />
            </View>
        </View>
        <View style={[styles.mockCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={[styles.mockDot, { backgroundColor: colors.primary }]} />
            <View style={styles.mockCardBody}>
                <Bar w='80%' color={colors.text} h={3} />
                <View style={{ height: 3 }} />
                <Bar w='55%' color={colors.textSecondary} h={3} />
            </View>
        </View>
        <View style={[styles.mockCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={[styles.mockDot, { backgroundColor: colors.secondary }]} />
            <View style={styles.mockCardBody}>
                <Bar w='65%' color={colors.text} h={3} />
            </View>
        </View>
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
        aspectRatio: 1,
        overflow: 'hidden',
    },
    dim: {
        opacity: 0.45,
    },
    mockup: {
        flex: 1,
        padding: 7,
    },
    mockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 7,
    },
    mockHeaderIcon: {
        width: 13,
        height: 13,
        borderRadius: 4,
        marginRight: 5,
    },
    mockHeaderText: {
        flex: 1,
    },
    mockCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 6,
        padding: 4,
        marginBottom: 4,
    },
    mockDot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        marginRight: 5,
    },
    mockCardBody: {
        flex: 1,
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
