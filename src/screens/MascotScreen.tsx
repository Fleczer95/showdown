import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable as RNPressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Lock } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import SafeContainer from '../responsive/SafeContainer';
import Text from '../components/atoms/Text';
import Pressable from '../components/atoms/HapticPressable';
import IconButton from '../components/molecules/IconButton';
import BottomSheet from '../components/molecules/BottomSheet';
import { useTheme } from '../theme';
import { useTranslation } from '../i18n';
import { useResponsive } from '../responsive/useResponsive';
import { Mascot } from '../game/mascot/Mascot';
import {
    MASCOT_PALETTE,
    MASCOT_PRESETS,
    type LookMap,
    type MascotPreset,
    type MascotSlot,
    resolveSlotColor,
} from '../game/mascot/look';
import { getEquippedLook, setEquippedLook } from '../game/mascot/equippedLook';
import { mascotSkins } from '../data/store/mascotSkins';

const SLOTS: MascotSlot[] = ['fur', 'suit', 'accent', 'mic'];
const MASCOT_SIZE = 240;

/**
 * Swatches the player does not own yet. Derived from the skin bundle's `unlocks`
 * list (plan §5) — NOT from catalog ownership, since `mascotSkins` isn't wired
 * into `STORE_CATALOG` until Phase 3. Everything not in this set (the per-slot
 * defaults, later any earned colors excluded from `unlocks`) is free to equip.
 */
const LOCKED_IDS = new Set(mascotSkins.flatMap((skin) => skin.unlocks));

const isLocked = (colorId: string) => LOCKED_IDS.has(colorId);

/**
 * Approximate tap zones over the placeholder fox, in the SVG's 200×220 viewBox.
 * A slot can have several rects (fur = head + tail, which are separate shapes).
 */
const HIT_ZONES: { slot: MascotSlot; x: number; y: number; w: number; h: number }[] = [
    { slot: 'fur', x: 50, y: 30, w: 100, h: 96 }, // head + ears
    { slot: 'fur', x: 16, y: 114, w: 56, h: 74 }, // tail
    { slot: 'suit', x: 62, y: 126, w: 76, h: 84 },
    { slot: 'accent', x: 88, y: 120, w: 24, h: 64 },
    { slot: 'mic', x: 132, y: 122, w: 36, h: 80 },
];

/**
 * Mascot customizer (plan §5). The live fox fills the stage; tapping a region on
 * the fox OR an explicit slot button slides up a bottom sheet of that slot's
 * colors. Selecting an owned color recolors the fox live and persists the look
 * immediately. The fox scales down + lifts while the sheet is open so the whole
 * mascot stays visible. Replaces the throwaway PoC harness behind the `Mascot`
 * route.
 */
export function MascotScreen() {
    const navigation = useNavigation();
    const { t } = useTranslation();
    const theme = useTheme();
    const { iconSize, scale } = useResponsive();
    const reduced = useReducedMotion();

    const [look, setLook] = useState<LookMap>(() => getEquippedLook());
    const [activeSlot, setActiveSlot] = useState<MascotSlot | null>(null);
    const sheetOpen = activeSlot !== null;

    // Equip an owned color: live recolor + immediate persistence (plan §5).
    const equipColor = (slot: MascotSlot, colorId: string) => {
        if (isLocked(colorId)) return; // Phase 2 shows locked swatches but can't buy.
        setLook((prev) => {
            const next = { ...prev, [slot]: colorId };
            setEquippedLook(next);
            return next;
        });
    };

    const applyPreset = (preset: MascotPreset) => {
        if (Object.values(preset.look).some(isLocked)) return;
        setLook({ ...preset.look });
        setEquippedLook(preset.look);
    };

    // Lift + shrink the fox while the sheet covers the lower screen (plan §5).
    const lift = useSharedValue(0);
    const shrink = useSharedValue(1);
    useEffect(() => {
        const liftTo = sheetOpen ? -scale(56) : 0;
        const shrinkTo = sheetOpen ? 0.78 : 1;
        if (reduced) {
            lift.value = liftTo;
            shrink.value = shrinkTo;
            return;
        }
        lift.value = withSpring(liftTo, { damping: 18, stiffness: 140 });
        shrink.value = withSpring(shrinkTo, { damping: 18, stiffness: 140 });
    }, [sheetOpen, reduced, lift, shrink, scale]);

    const stageStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: lift.value }, { scale: shrink.value }],
    }));

    const k = MASCOT_SIZE / 200; // viewBox → px scale (uniform; see Mascot.tsx).

    const sheetSwatches = useMemo(() => {
        if (!activeSlot) return [];
        // Unlocked first, then locked-with-badge (plan §5).
        return [...MASCOT_PALETTE[activeSlot]].sort((a, b) => Number(isLocked(a.id)) - Number(isLocked(b.id)));
    }, [activeSlot]);

    return (
        <SafeContainer edges={['top', 'bottom']} enableLeftSwipe>
            <View style={[styles.header, { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md }]}>
                <IconButton
                    icon={<ChevronLeft size={iconSize(24)} color={theme.colors.text} />}
                    onPress={() => navigation.goBack()}
                    size='md'
                    accessibilityLabel={t('screen.settings.back')}
                />
                <Text variant='heading' weight='bold' style={styles.title}>
                    {t('screen.mascot.title')}
                </Text>
                <View style={{ width: scale(44) }} />
            </View>

            <Text
                variant='body'
                color={theme.colors.textSecondary}
                style={{ textAlign: 'center', paddingHorizontal: theme.spacing.lg }}
            >
                {t('screen.mascot.subtitle')}
            </Text>

            {/* Live fox + transparent per-region tap zones. */}
            <View style={styles.stage}>
                <Animated.View style={[{ width: MASCOT_SIZE, height: MASCOT_SIZE * 1.1 }, stageStyle]}>
                    <Mascot look={look} pose='idle' size={MASCOT_SIZE} />
                    {/* Plain RN Pressable: it applies the absolute position+size to the
                        touchable itself. (HapticPressable would put the style on an inner
                        view, collapsing the hit target to zero — see ThemeScreen note.) */}
                    {HIT_ZONES.map((z, i) => (
                        <RNPressable
                            key={`${z.slot}-${i}`}
                            onPress={() => setActiveSlot(z.slot)}
                            accessibilityRole='button'
                            accessibilityLabel={t(`screen.mascot.slots.${z.slot}`)}
                            style={[styles.hitZone, { left: z.x * k, top: z.y * k, width: z.w * k, height: z.h * k }]}
                        />
                    ))}
                </Animated.View>
            </View>

            {/* Slot buttons — the accessible path (plan §5). */}
            <View style={[styles.slotRow, { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm }]}>
                {SLOTS.map((slot) => (
                    <View key={slot} style={styles.slotCell}>
                        <Pressable
                            onPress={() => setActiveSlot(slot)}
                            haptic='light'
                            accessibilityRole='button'
                            accessibilityLabel={t(`screen.mascot.slots.${slot}`)}
                            style={[
                                styles.slotButton,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: activeSlot === slot ? theme.colors.primary : theme.colors.border,
                                    borderRadius: theme.radii.lg,
                                    padding: theme.spacing.sm,
                                    gap: theme.spacing.xs,
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.slotDot,
                                    {
                                        backgroundColor: resolveSlotColor(slot, look[slot]),
                                        borderColor: theme.colors.border,
                                    },
                                ]}
                            />
                            <Text variant='caption' weight='semibold' color={theme.colors.textSecondary}>
                                {t(`screen.mascot.slots.${slot}`)}
                            </Text>
                        </Pressable>
                    </View>
                ))}
            </View>

            {/* Preset shortcuts. */}
            <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg }}>
                <Text
                    variant='caption'
                    weight='bold'
                    color={theme.colors.textSecondary}
                    style={[styles.sectionLabel, { marginBottom: theme.spacing.sm }]}
                >
                    {t('screen.mascot.presets.title')}
                </Text>
                <View style={[styles.presetRow, { gap: theme.spacing.sm }]}>
                    {MASCOT_PRESETS.map((preset) => {
                        const locked = Object.values(preset.look).some(isLocked);
                        return (
                            <Pressable
                                key={preset.id}
                                onPress={() => applyPreset(preset)}
                                disabled={locked}
                                haptic='light'
                                accessibilityRole='button'
                                accessibilityLabel={t(`screen.mascot.presets.${preset.id}`)}
                                style={[
                                    styles.presetChip,
                                    {
                                        backgroundColor: theme.colors.surface,
                                        borderColor: theme.colors.border,
                                        borderRadius: theme.radii.full,
                                        paddingVertical: theme.spacing.xs,
                                        paddingHorizontal: theme.spacing.md,
                                        gap: theme.spacing.xs,
                                        opacity: locked ? 0.55 : 1,
                                    },
                                ]}
                            >
                                {locked ? <Lock size={iconSize(13)} color={theme.colors.textMuted} /> : null}
                                <Text variant='caption' weight='semibold'>
                                    {t(`screen.mascot.presets.${preset.id}`)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <BottomSheet
                visible={sheetOpen}
                onClose={() => setActiveSlot(null)}
                title={activeSlot ? t(`screen.mascot.slots.${activeSlot}`) : undefined}
            >
                <View style={[styles.swatchGrid, { gap: theme.spacing.md, paddingBottom: theme.spacing.md }]}>
                    {sheetSwatches.map((sw) => {
                        const locked = isLocked(sw.id);
                        const selected = activeSlot !== null && look[activeSlot] === sw.id;
                        return (
                            <Pressable
                                key={sw.id}
                                onPress={() => activeSlot && equipColor(activeSlot, sw.id)}
                                disabled={locked}
                                haptic='light'
                                accessibilityRole='button'
                                accessibilityState={{ selected, disabled: locked }}
                                style={styles.swatchCell}
                            >
                                <View
                                    style={[
                                        styles.swatch,
                                        {
                                            backgroundColor: sw.hex,
                                            borderColor: selected ? theme.colors.text : 'transparent',
                                            borderRadius: theme.radii.md,
                                            opacity: locked ? 0.5 : 1,
                                        },
                                    ]}
                                />
                                {locked ? (
                                    <View
                                        style={[
                                            styles.lockBadge,
                                            { backgroundColor: theme.colors.overlay, borderRadius: theme.radii.full },
                                        ]}
                                    >
                                        <Lock size={iconSize(14)} color='#FFFFFF' />
                                    </View>
                                ) : null}
                            </Pressable>
                        );
                    })}
                </View>
            </BottomSheet>
        </SafeContainer>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    stage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hitZone: {
        position: 'absolute',
    },
    slotRow: {
        flexDirection: 'row',
    },
    slotCell: {
        flex: 1,
    },
    slotButton: {
        alignItems: 'center',
        borderWidth: 1.5,
    },
    slotDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
    },
    sectionLabel: {
        letterSpacing: 1.2,
    },
    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    presetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    swatchGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    swatchCell: {
        position: 'relative',
    },
    swatch: {
        width: 56,
        height: 56,
        borderWidth: 3,
    },
    lockBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        padding: 3,
    },
});

export default MascotScreen;
