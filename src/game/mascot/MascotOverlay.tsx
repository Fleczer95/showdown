import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    Easing,
    useReducedMotion,
    runOnJS,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Mascot } from './Mascot';
import { getEquippedLook } from './equippedLook';
import { type LookMap, type MascotPose } from './look';
import type { MascotExpression } from './reactions/expressions';
import { useHaptics } from '../../hooks/useHaptics';
import { useTheme } from '../../theme';
import Text from '../../components/atoms/Text';
import PressableButton from '../../components/atoms/HapticPressable';

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
    message?: string | null;
    expression?: MascotExpression;
    /** When set with a non-null message, fire `onAutoHide` after this many ms. */
    autoHideMs?: number;
    onAutoHide?: () => void;
    onMessagePress?: () => void;
    onMascotPress?: () => void;
    onSettled?: () => void;
}

export function MascotOverlay({
    pose,
    size = 140,
    anchor = 'bottom-right',
    offset,
    inline = false,
    message,
    expression,
    autoHideMs,
    onAutoHide,
    onMessagePress,
    onMascotPress,
    onSettled,
}: MascotOverlayProps) {
    const theme = useTheme();
    const reduced = useReducedMotion();
    const haptics = useHaptics();
    const [look, setLook] = useState<LookMap>(getEquippedLook);
    const tapMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Off-edge resting point for the slide-in: inline leads from the left; the
    // overlay slides from whichever screen edge it anchors to.
    const hidden = inline || anchor === 'bottom-left' ? -(size + 24) : size + 24;
    const slide = useSharedValue(reduced ? 0 : hidden);
    // A 0→1→0 tap pulse: drives a little jump + squash when the fox is tapped.
    const bounce = useSharedValue(0);
    const bubbleReveal = useSharedValue(message ? 1 : 0);

    const onTap = useCallback(() => {
        haptics.light();
        if (tapMessageTimer.current) clearTimeout(tapMessageTimer.current);
        if (reduced) {
            onMascotPress?.();
            return;
        }
        bounce.value = withSequence(
            withTiming(1, { duration: 130, easing: Easing.out(Easing.back(2)) }),
            withSpring(0, { damping: 7, stiffness: 200 }),
        );
        tapMessageTimer.current = setTimeout(() => {
            onMascotPress?.();
            tapMessageTimer.current = null;
        }, 280);
    }, [haptics, reduced, bounce, onMascotPress]);

    useEffect(() => {
        return () => {
            if (tapMessageTimer.current) clearTimeout(tapMessageTimer.current);
        };
    }, []);

    // Re-read the equipped look (and, for the overlay, replay the slide-in) every
    // time the screen gains focus — so returning from the customizer shows the new look.
    useFocusEffect(
        useCallback(() => {
            setLook(getEquippedLook());
            if (reduced) {
                slide.value = 0;
                onSettled?.();
                return;
            }
            slide.value = hidden;
            slide.value = withSpring(0, { damping: 14, stiffness: 120 }, (finished) => {
                if (finished && onSettled) runOnJS(onSettled)();
            });
        }, [reduced, hidden, slide, onSettled]),
    );

    const animStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: slide.value },
            { translateY: -6 * bounce.value },
            { scale: 1 + 0.025 * bounce.value },
        ],
    }));

    useEffect(() => {
        if (!message) {
            bubbleReveal.value = reduced ? 0 : withTiming(0, { duration: 120 });
            return;
        }
        if (reduced) {
            bubbleReveal.value = 1;
            return;
        }
        bubbleReveal.value = 0;
        bubbleReveal.value = withSpring(1, { damping: 10, stiffness: 170 });
    }, [message, reduced, bubbleReveal]);

    const bubbleAnimStyle = useAnimatedStyle(() => ({
        opacity: bubbleReveal.value,
        transform: [
            { translateY: (1 - bubbleReveal.value) * 10 },
            { scale: 0.9 + bubbleReveal.value * 0.1 },
        ],
    }));

    // Auto-hide a spoken bubble after a timeout (the director drops the rest).
    useEffect(() => {
        if (!message || !autoHideMs) return;
        const id = setTimeout(() => onAutoHide?.(), autoHideMs);
        return () => clearTimeout(id);
    }, [message, autoHideMs, onAutoHide]);

    const mascot = (
        <Pressable onPress={onTap} accessibilityRole='image' accessibilityLabel='Mascot'>
            <Mascot look={look} pose={pose} size={size} expression={expression} />
        </Pressable>
    );

    const bubbleFrameStyle = [
        styles.bubbleFrame,
        {
            maxWidth: Math.max(176, size * 1.75),
            right: anchor === 'bottom-right' ? size * 0.72 : undefined,
            left: anchor === 'bottom-left' ? size * 0.72 : undefined,
            bottom: size * 0.78,
        },
        bubbleAnimStyle,
    ];

    const bubbleBoxStyle = [
        styles.bubble,
        {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderLight,
            borderRadius: theme.radii.xl,
            shadowColor: theme.colors.shadow,
        },
    ];

    const bubbleContent = message ? (
        <View pointerEvents='none'>
            <Text variant='body' weight='medium' color='text' numberOfLines={3} adjustsFontSizeToFit>
                {message}
            </Text>
            <View
                style={[
                    styles.bubbleTail,
                    anchor === 'bottom-right' ? styles.bubbleTailRight : styles.bubbleTailLeft,
                    {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.borderLight,
                    },
                ]}
            />
        </View>
    ) : null;

    const bubble = message ? (
        <Animated.View pointerEvents='box-none' style={bubbleFrameStyle}>
            {onMessagePress ? (
                <PressableButton
                    onPress={onMessagePress}
                    haptic='light'
                    accessibilityRole='button'
                    accessibilityLabel={message}
                    style={bubbleBoxStyle}
                >
                    {bubbleContent}
                </PressableButton>
            ) : (
                <View style={bubbleBoxStyle} accessibilityRole='text' accessibilityLabel={message}>
                    {bubbleContent}
                </View>
            )}
        </Animated.View>
    ) : null;

    if (inline) {
        return (
            <Animated.View style={animStyle}>
                {bubble}
                {mascot}
            </Animated.View>
        );
    }

    const x = offset?.x ?? 0;
    const y = offset?.y ?? 0;

    return (
        <Animated.View
            pointerEvents='box-none'
            style={[styles.overlay, anchor === 'bottom-left' ? { left: x } : { right: x }, { bottom: y }, animStyle]}
        >
            {bubble}
            {mascot}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
    },
    bubbleFrame: {
        position: 'absolute',
    },
    bubble: {
        borderWidth: 1,
        minWidth: 184,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    bubbleTail: {
        position: 'absolute',
        width: 14,
        height: 14,
        bottom: -16,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        transform: [{ rotate: '45deg' }],
    },
    bubbleTailRight: {
        right: 10,
    },
    bubbleTailLeft: {
        left: 10,
    },
});
