import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    Easing,
    useReducedMotion,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Mascot } from './Mascot';
import { getEquippedLook } from './equippedLook';
import { type LookMap, type MascotPose } from './look';
import { useHaptics } from '../../hooks/useHaptics';

/**
 * Self-contained mascot placement (plan §4): renders the device's equipped look
 * in a given pose, tappable for a quick bounce. Two modes:
 *
 * - **overlay** (default): an absolutely-positioned corner host that slides in
 *   from a screen edge via a Reanimated transform. Used on Home. The container is
 *   `box-none` and only the fox box is interactive, so taps elsewhere pass
 *   through to the buttons underneath.
 * - **inline**: an in-flow element (no absolute positioning) that sits in the
 *   layout and scrolls with the content. Still slides in via a transform — from
 *   the left, since the fox leads the row. Used on a game's Results header so the
 *   mascot stays put relative to the card.
 *
 * The overlay only knows the 4 poses — the host screen decides which to show
 * (Home: intro→idle; Results: the game classifies its own outcome into
 * cheer|dismay). The equipped look is read straight from `getEquippedLook`, so
 * the mascot always reflects whatever the customizer last saved; it re-reads on
 * focus so a freshly-equipped look shows when you return to the screen.
 */

type Anchor = 'bottom-right' | 'bottom-left';

export interface MascotOverlayProps {
    pose: MascotPose;
    size?: number;
    anchor?: Anchor;
    /** Distance from the anchored edges. */
    offset?: { x?: number; y?: number };
    /** In-flow placement (scrolls with content; still slides in, from the left). */
    inline?: boolean;
}

export function MascotOverlay({
    pose,
    size = 140,
    anchor = 'bottom-right',
    offset,
    inline = false,
}: MascotOverlayProps) {
    const reduced = useReducedMotion();
    const haptics = useHaptics();
    const [look, setLook] = useState<LookMap>(getEquippedLook);

    // Off-edge resting point for the slide-in: inline leads from the left; the
    // overlay slides from whichever screen edge it anchors to.
    const hidden = inline || anchor === 'bottom-left' ? -(size + 24) : size + 24;
    const slide = useSharedValue(reduced ? 0 : hidden);
    // A 0→1→0 tap pulse: drives a little jump + squash when the fox is tapped.
    const bounce = useSharedValue(0);

    const onTap = useCallback(() => {
        haptics.light();
        if (reduced) return;
        bounce.value = withSequence(
            withTiming(1, { duration: 130, easing: Easing.out(Easing.back(2)) }),
            withSpring(0, { damping: 7, stiffness: 200 }),
        );
    }, [haptics, reduced, bounce]);

    // Re-read the equipped look (and, for the overlay, replay the slide-in) every
    // time the screen gains focus — so returning from the customizer shows the new look.
    useFocusEffect(
        useCallback(() => {
            setLook(getEquippedLook());
            if (reduced) {
                slide.value = 0;
                return;
            }
            slide.value = hidden;
            slide.value = withSpring(0, { damping: 14, stiffness: 120 });
        }, [reduced, hidden, slide]),
    );

    const animStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: slide.value },
            { translateY: -16 * bounce.value },
            { scale: 1 + 0.12 * bounce.value },
        ],
    }));

    const mascot = (
        <Pressable onPress={onTap} accessibilityRole='image' accessibilityLabel='Mascot'>
            <Mascot look={look} pose={pose} size={size} />
        </Pressable>
    );

    if (inline) {
        return <Animated.View style={animStyle}>{mascot}</Animated.View>;
    }

    const x = offset?.x ?? 0;
    const y = offset?.y ?? 0;

    return (
        <Animated.View
            pointerEvents='box-none'
            style={[styles.overlay, anchor === 'bottom-left' ? { left: x } : { right: x }, { bottom: y }, animStyle]}
        >
            {mascot}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
    },
});
