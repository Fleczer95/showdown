import React, { useEffect } from 'react';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withSpring,
    Easing,
    useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Circle, Rect, Polygon, Ellipse, Line } from 'react-native-svg';
import { type LookMap, type MascotPose, resolveSlotColor } from './look';

/**
 * The mascot render path (plan §7.2): a pure, ownership-agnostic function of
 * (look, pose). It draws ANY valid look map — ownership gates equipping your own
 * mascot, never DISPLAYING one, so the v2 challenge screen calls the same render
 * with the sender's map. Unknown colorIds fall back to the slot default (§7.3).
 *
 * The shapes here are PLACEHOLDER primitives (orange blob fox, blue rect suit,
 * accent tie, gold mic) carried over from the device-verified PoC. Phase 6 swaps
 * them for the hand-cleaned multi-region SVG fox; the named-fill seam and this
 * signature stay. The recolor seam = overriding each region's `fill` at runtime.
 */

const SHADE = 'rgba(0,0,0,0.18)'; // shading overlay — NOT recolored (plan §2)
const HILITE = 'rgba(255,255,255,0.22)'; // highlight overlay — NOT recolored

/**
 * The drawn fox occupies y∈[34,210] of the old 0–220 viewBox (big empty top/bottom
 * margins). We frame it tightly so the rendered box ≈ the fox — positioning the
 * mascot is then precise (no off-centre hang). Width stays 200 so the px-per-unit
 * scale is uniform on both axes (the customizer's hit-zones rely on that; they
 * only offset their `y` by `minY`). Phase 6 art keeps these bounds.
 */
export const MASCOT_VIEWBOX = { minY: 30, width: 200, height: 184 } as const;
export const MASCOT_ASPECT = MASCOT_VIEWBOX.height / MASCOT_VIEWBOX.width; // height ÷ width

export interface MascotProps {
    look: LookMap;
    pose: MascotPose;
    size?: number;
}

export function Mascot({ look, pose, size = 240 }: MascotProps) {
    const reduced = useReducedMotion();

    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const rotate = useSharedValue(0);
    const opacity = useSharedValue(1);

    useEffect(() => {
        // Cancel-by-overwrite: each pose sets the full transform target.
        if (reduced) {
            translateY.value = 0;
            scale.value = 1;
            rotate.value = 0;
            opacity.value = 1;
            return;
        }
        switch (pose) {
            case 'intro':
                opacity.value = 0;
                translateY.value = 60;
                scale.value = 1;
                rotate.value = 0;
                opacity.value = withTiming(1, { duration: 380 });
                translateY.value = withSpring(0, { damping: 12, stiffness: 140 });
                break;
            case 'idle':
                opacity.value = withTiming(1, { duration: 200 });
                rotate.value = withTiming(0);
                translateY.value = withTiming(0);
                // Gentle breathing.
                scale.value = withRepeat(
                    withTiming(1.035, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
                    -1,
                    true,
                );
                break;
            case 'cheer':
                opacity.value = withTiming(1, { duration: 120 });
                rotate.value = 0;
                // Scale-pop then settle, with an upward bounce.
                scale.value = withSequence(
                    withTiming(1.22, { duration: 160, easing: Easing.out(Easing.back(2)) }),
                    withSpring(1, { damping: 9, stiffness: 180 }),
                );
                translateY.value = withSequence(
                    withTiming(-22, { duration: 160 }),
                    withSpring(0, { damping: 8, stiffness: 160 }),
                );
                break;
            case 'dismay':
                opacity.value = withTiming(1, { duration: 120 });
                scale.value = withTiming(0.97, { duration: 240 });
                // A small slump + a quick disappointed head shake (kept subtle so the
                // fox still reads as centred next to the result text).
                translateY.value = withTiming(4, { duration: 240, easing: Easing.in(Easing.quad) });
                rotate.value = withSequence(
                    withTiming(-7, { duration: 90 }),
                    withTiming(7, { duration: 90 }),
                    withTiming(-4, { duration: 90 }),
                    withTiming(0, { duration: 90 }),
                );
                break;
        }
    }, [pose, reduced, translateY, scale, rotate, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }, { scale: scale.value }, { rotateZ: `${rotate.value}deg` }],
    }));

    // Resolve the four named fills from the look map (the recolor seam).
    const fur = resolveSlotColor('fur', look.fur);
    const suit = resolveSlotColor('suit', look.suit);
    const accent = resolveSlotColor('accent', look.accent);
    const mic = resolveSlotColor('mic', look.mic);

    return (
        <Animated.View style={animatedStyle}>
            <Svg
                width={size}
                height={size * MASCOT_ASPECT}
                viewBox={`0 ${MASCOT_VIEWBOX.minY} ${MASCOT_VIEWBOX.width} ${MASCOT_VIEWBOX.height}`}
            >
                {/* ---- TAIL (fur) ---- */}
                <Ellipse cx='44' cy='150' rx='26' ry='34' fill={fur} />
                <Ellipse cx='40' cy='168' rx='16' ry='18' fill={HILITE} />

                {/* ---- SUIT body (suit) ---- */}
                <Rect x='62' y='118' width='76' height='92' rx='22' fill={suit} />
                {/* suit shading on the lower-left */}
                <Rect x='62' y='170' width='76' height='40' rx='20' fill={SHADE} />
                {/* lapels (suit, with accent tie between) */}
                <Polygon points='100,118 78,118 96,160' fill={suit} />
                <Polygon points='100,118 122,118 104,160' fill={suit} />
                <Polygon points='100,118 78,118 96,160' fill={SHADE} />

                {/* ---- ACCENT tie ---- */}
                <Polygon points='100,122 92,140 100,182 108,140' fill={accent} />
                <Polygon points='100,150 92,140 100,182' fill={SHADE} />

                {/* ---- HEAD (fur) ---- */}
                {/* ears */}
                <Polygon points='58,40 78,78 44,72' fill={fur} />
                <Polygon points='142,40 122,78 156,72' fill={fur} />
                <Polygon points='62,50 74,74 54,70' fill={SHADE} />
                {/* skull */}
                <Circle cx='100' cy='80' r='46' fill={fur} />
                {/* snout / muzzle highlight */}
                <Ellipse cx='100' cy='96' rx='30' ry='22' fill={HILITE} />
                {/* nose */}
                <Circle cx='100' cy='92' r='7' fill='#1F2937' />
                {/* eyes */}
                <Circle cx='84' cy='74' r='6' fill='#1F2937' />
                <Circle cx='116' cy='74' r='6' fill='#1F2937' />
                <Circle cx='86' cy='72' r='2' fill='#FFFFFF' />
                <Circle cx='118' cy='72' r='2' fill='#FFFFFF' />

                {/* ---- MIC (mic) ---- */}
                {/* stick (neutral, not recolored) */}
                <Line x1='150' y1='196' x2='150' y2='150' stroke='#374151' strokeWidth='6' strokeLinecap='round' />
                {/* head */}
                <Circle cx='150' cy='140' r='16' fill={mic} />
                <Circle cx='145' cy='135' r='6' fill={HILITE} />
                <Circle cx='150' cy='148' r='14' fill={SHADE} opacity={0.4} />
            </Svg>
        </Animated.View>
    );
}

/**
 * The pure render entry point (plan §7.2). Phase 2's customizer, Phase 5's
 * Home/Results placement, and the v2 challenge screen all call this — none of
 * them need to know whether the look is owned.
 */
export function renderMascot(look: LookMap, pose: MascotPose, size?: number) {
    return <Mascot look={look} pose={pose} size={size} />;
}
