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
 * Self-contained mascot placement (plan §4): an absolutely-positioned overlay
 * that slides in from a screen edge via a Reanimated transform and renders the
 * device's equipped look in a given pose. Mount it on any screen (Home, a game's
 * Results) and drive the reaction with `pose`.
 *
 * The overlay only knows the 4 poses — the host screen decides which to show
 * (Home: intro→idle; Results: the game classifies its own outcome into
 * cheer|dismay). The equipped look is read straight from `getEquippedLook`, so
 * the mascot always reflects whatever the customizer last saved; it re-reads on
 * focus so a freshly-equipped look shows when you return to the screen.
 *
 * Tapping the fox plays a quick bounce (with a light haptic). Only the fox box
 * is interactive — the container is `box-none`, so taps anywhere else pass
 * through to the buttons underneath.
 */

type Anchor = 'bottom-right' | 'bottom-left';

export interface MascotOverlayProps {
    pose: MascotPose;
    size?: number;
    anchor?: Anchor;
    /** Distance from the anchored edges. */
    offset?: { x?: number; y?: number };
}

export function MascotOverlay({ pose, size = 140, anchor = 'bottom-right', offset }: MascotOverlayProps) {
    const reduced = useReducedMotion();
    const haptics = useHaptics();
    const [look, setLook] = useState<LookMap>(getEquippedLook);

    // Off-edge resting point: slide in from whichever horizontal edge we anchor to.
    const hidden = anchor === 'bottom-left' ? -(size + 24) : size + 24;
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

    // Re-read the equipped look and replay the slide-in every time the screen
    // gains focus (so returning from the customizer shows the new look).
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

    const slideStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: slide.value },
            { translateY: -16 * bounce.value },
            { scale: 1 + 0.12 * bounce.value },
        ],
    }));

    const x = offset?.x ?? 0;
    const y = offset?.y ?? 0;

    return (
        <Animated.View
            pointerEvents='box-none'
            style={[styles.overlay, anchor === 'bottom-left' ? { left: x } : { right: x }, { bottom: y }, slideStyle]}
        >
            <Pressable onPress={onTap} accessibilityRole='image' accessibilityLabel='Mascot'>
                <Mascot look={look} pose={pose} size={size} />
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
    },
});
