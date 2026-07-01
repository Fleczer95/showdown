import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Mascot, MASCOT_ASPECT, MASCOT_VIEWBOX } from '../game/mascot/Mascot';
import {
    MASCOT_PALETTE,
    MASCOT_PRESETS,
    type LookMap,
    type MascotPreset,
    type MascotSlot,
    resolveSlotColor,
} from '../game/mascot/look';
import { getEquippedLook, setEquippedLook } from '../game/mascot/equippedLook';
import { useMascotEmit } from '../game/mascot/reactions/useMascotDirector';
import { mascotSkins } from '../data/store/mascotSkins';
import { useStore } from '../hooks/store/useStore';
import { resolveEntryState } from '../data/store/resolver';
import { useProgression } from '../hooks/useProgression';
import { PROGRESSION_MASCOT_COLORS } from '../game/progression/mascotColors';

const SLOTS: MascotSlot[] = ['fur', 'suit', 'accent', 'mic'];
const MASCOT_SIZE = 240;

/** The bundle whose purchase unlocks a given color (one bundle in v1, plan §5). */
const skinForColor = (colorId: string) => mascotSkins.find((skin) => skin.unlocks.includes(colorId));

/** Earned colorId → its Level Map reward id. Earned colors are unlocked by progression, never bought. */
const REWARD_BY_COLOR = new Map(PROGRESSION_MASCOT_COLORS.map((c) => [c.colorId, c.id]));

/**
 * Approximate tap zones over the Phase 6 fox, in the fox's shape coordinates
 * (the 0–200 viewBox space; the rendered viewBox is framed tighter, so `top` is
 * offset by `MASCOT_VIEWBOX.minY` below). A slot can have several rects (fur =
 * head + tail, which are separate shapes). Order matters: later rects render on
 * top, so overlaps resolve to the last match (accent tie + mic win over the body).
 */
const HIT_ZONES: { slot: MascotSlot; x: number; y: number; w: number; h: number }[] = [
    { slot: 'fur', x: 44, y: 34, w: 114, h: 94 }, // ears + head + cheeks
    { slot: 'fur', x: 16, y: 108, w: 56, h: 78 }, // tail
    { slot: 'suit', x: 44, y: 130, w: 112, h: 82 }, // jacket body + lapels + sleeve
    { slot: 'accent', x: 86, y: 138, w: 28, h: 64 }, // tie
    { slot: 'mic', x: 110, y: 135, w: 42, h: 50 }, // grille head + paw grip
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
    const { purchasedItemIds, purchaseItem, isProcessing } = useStore();
    const { unlockedRewards } = useProgression();
    const emitMascot = useMascotEmit();

    const [look, setLook] = useState<LookMap>(() => getEquippedLook());
    const [activeSlot, setActiveSlot] = useState<MascotSlot | null>(null);
    const sheetOpen = activeSlot !== null;

    /**
     * Colors the player can't equip yet. Derived from real catalog ownership
     * (plan §5): every bundle still resolving to `locked` contributes its
     * `unlocks`. Buying the bundle flips `purchasedItemIds`, which recomputes
     * this set and clears the lock badges reactively.
     */
    const lockedIds = useMemo(() => {
        const owned = new Set(purchasedItemIds);
        const locked = new Set<string>();
        for (const skin of mascotSkins) {
            if (resolveEntryState(skin, owned) === 'locked') {
                for (const id of skin.unlocks) locked.add(id);
            }
        }
        return locked;
    }, [purchasedItemIds]);

    const isLocked = useCallback(
        (colorId: string) => {
            const reward = REWARD_BY_COLOR.get(colorId);
            // Earned colors unlock by climbing the Level Map, not by buying the bundle.
            if (reward) return !unlockedRewards.has(reward);
            return lockedIds.has(colorId);
        },
        [lockedIds, unlockedRewards],
    );

    // (plan §5). Reuses the same `purchaseItem` flow as theme/pack purchases; the
    // unlock lands via `onPurchaseSuccess` → reactive `purchasedItemIds`.
    // (Deprecated: we now navigate to the Store screen directly)

    // A locked color splits two ways (plan §5): an EARNED color deep-links to the
    // Level Map (and highlights the unlocking level); a PURCHASABLE color routes
    // through the billing engine to buy the bundle.
    const handleLocked = useCallback(
        (colorId: string) => {
            const reward = REWARD_BY_COLOR.get(colorId);
            if (reward) {
                setActiveSlot(null); // close the sheet so it isn't left open on return
                navigation.navigate('Progress' as any, { focusRewardId: reward });
                return;
            }
            const skin = skinForColor(colorId);
            if (skin) {
                setActiveSlot(null);
                navigation.navigate('Store' as any, { gameId: 'mascots', itemId: skin.id });
            }
        },
        [navigation],
    );

    // Tapping an owned color equips it (live recolor + immediate persistence);
    // tapping a locked one buys its bundle or deep-links to progression (plan §5).
    const equipColor = (slot: MascotSlot, colorId: string) => {
        if (isLocked(colorId)) {
            handleLocked(colorId);
            return;
        }
        setLook((prev) => {
            const next = { ...prev, [slot]: colorId };
            setEquippedLook(next);
            return next;
        });
    };

    const applyPreset = (preset: MascotPreset) => {
        const lockedColor = Object.values(preset.look).find(isLocked);
        if (lockedColor) {
            handleLocked(lockedColor);
            return;
        }
        setLook({ ...preset.look });
        setEquippedLook(preset.look);
        emitMascot('look-equipped');
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
    }, [activeSlot, isLocked]);

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
                <Animated.View style={[{ width: MASCOT_SIZE, height: MASCOT_SIZE * MASCOT_ASPECT }, stageStyle]}>
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
                            style={[
                                styles.hitZone,
                                {
                                    left: z.x * k,
                                    top: (z.y - MASCOT_VIEWBOX.minY) * k,
                                    width: z.w * k,
                                    height: z.h * k,
                                },
                            ]}
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
                        const isActive = Object.entries(preset.look).every(([k, v]) => look[k as keyof typeof look] === v);
                        return (
                            <Pressable
                                key={preset.id}
                                onPress={() => applyPreset(preset)}
                                disabled={isProcessing}
                                haptic='light'
                                accessibilityRole='button'
                                accessibilityLabel={t(`screen.mascot.presets.${preset.id}`)}
                                style={[
                                    styles.presetChip,
                                    {
                                        backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceVariant,
                                        borderRadius: theme.radii.full,
                                        paddingVertical: theme.spacing.sm,
                                        paddingHorizontal: theme.spacing.lg,
                                        gap: theme.spacing.sm,
                                        opacity: locked ? 0.55 : 1,
                                        ...theme.shadows.sm,
                                    },
                                ]}
                            >
                                {locked ? <Lock size={iconSize(14)} color={isActive ? theme.colors.onPrimary : theme.colors.textMuted} /> : null}
                                <Text variant='caption' weight='semibold' color={isActive ? theme.colors.onPrimary : theme.colors.text}>
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
                                disabled={isProcessing}
                                haptic='light'
                                accessibilityRole='button'
                                accessibilityState={{ selected, disabled: isProcessing }}
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
