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
import Svg, { Path, Circle, Polygon, Ellipse, Line } from 'react-native-svg';
import { type LookMap, type MascotPose, resolveSlotColor } from './look';

/**
 * The mascot render path (plan §7.2): a pure, ownership-agnostic function of
 * (look, pose). It draws ANY valid look map — ownership gates equipping your own
 * mascot, never DISPLAYING one, so the v2 challenge screen calls the same render
 * with the sender's map. Unknown colorIds fall back to the slot default (§7.3).
 *
 * Phase 6 art: the hand-cleaned multi-region fox host. Four recolorable base
 * regions resolve their `fill` from the look map (the recolor seam): `fur`
 * (head/ears/tail/paw), `suit` (jacket/lapels/sleeve), `accent` (tie), `mic`
 * (microphone grille). Shading (SHADE) and highlight (HILITE) overlays are
 * separate semi-transparent paths drawn ON TOP and are NEVER recolored, so a
 * skin changes the flat base without flattening the form (plan §2). Fixed dark
 * facial features (eyes/nose/grin) and the neutral mic stick read on any palette.
 *
 * Single-shape + Reanimated transforms (device-verified smooth in Phase 0): the
 * 4 poses are driven entirely by the transform/opacity block below — there are no
 * per-pose shape variants, so the named-fill seam stays trivially correct.
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

/**
 * Node ceiling (plan §8). Phase 0 verified ~24 drawn SVG nodes animated smoothly
 * on a real device. The Phase 6 fox draws 36 nodes; the ceiling is set at 40 to
 * leave headroom for a future jackpot pose / patterns without re-measuring. Keep
 * additions under this — beyond it, re-measure on a low-end device before shipping.
 */
export const MASCOT_NODE_CEILING = 40;

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
                {/* ---- TAIL (fur) — bushy curl behind the body, lower-left ---- */}
                <Path
                    d='M60,182 C30,186 18,164 20,138 C22,118 38,110 48,116 C40,124 40,140 48,156 C54,170 62,176 68,178 Z'
                    fill={fur}
                />
                {/* cream fox tail tip — SOLID (never ghosts) + bounded inside the curl so it
                    can't spill onto the background. Caps the whole END of the curl (the last
                    third); the inner separation is a soft curve, not a straight cut. */}
                <Path d='M21,137 C23,119 38,111 47,116 C44,122 41,129 41,139 C34,145 27,144 21,137 Z' fill='#F8E6CE' />
                {/* darker base where the tail tucks behind the body — gives the curl depth */}
                <Path d='M52,168 C58,176 64,180 68,178 L60,182 C54,180 50,174 52,168 Z' fill={SHADE} />

                {/* ---- SUIT body (suit) — tailored jacket ---- */}
                <Path
                    d='M82,130 C64,134 52,146 48,166 L44,206 Q44,213 54,213 L146,213 Q156,213 156,206 L152,166 C148,146 136,134 118,130 Z'
                    fill={suit}
                />
                {/* slim shadow down the jacket's left edge (a thin sliver, not a panel) */}
                <Path d='M52,150 C49,158 46,170 44,206 Q44,213 54,213 L58,168 C56,160 54,154 52,150 Z' fill={SHADE} />
                {/* right sleeve (suit), raised to hold the mic */}
                <Path
                    d='M150,168 C158,160 161,150 158,140 C156,128 150,120 142,122 C136,124 136,134 138,144 C140,156 144,166 150,168 Z'
                    fill={suit}
                />
                {/* lapels (suit) — open V over the chest */}
                <Polygon points='82,130 60,150 90,182 98,140' fill={suit} />
                <Polygon points='118,130 140,150 110,182 102,140' fill={suit} />
                {/* lapel inner shadow */}
                <Polygon points='98,140 90,182 96,182 100,146' fill={SHADE} />
                {/* white chest fluff at the collar */}
                <Polygon points='90,132 110,132 100,146' fill={HILITE} />

                {/* ---- ACCENT tie ---- */}
                <Path d='M100,138 L108,146 L106,156 L112,194 L100,202 L88,194 L94,156 L92,146 Z' fill={accent} />
                <Polygon points='100,156 112,194 100,202' fill={SHADE} />

                {/* ---- EARS (fur) ---- */}
                <Polygon points='52,34 42,82 84,66' fill={fur} />
                <Polygon points='148,34 158,82 116,66' fill={fur} />
                <Polygon points='54,46 50,76 76,64' fill={SHADE} />
                <Polygon points='146,46 150,76 124,64' fill={SHADE} />

                {/* ---- HEAD (fur) — rounded face with cheek flares + pointed muzzle ---- */}
                <Path
                    d='M100,54 C84,52 64,58 56,76 C46,96 48,108 58,118 C70,130 84,132 100,138 C116,132 130,130 142,118 C152,108 154,96 144,76 C136,58 116,52 100,54 Z'
                    fill={fur}
                />
                {/* muzzle highlight */}
                <Ellipse cx='100' cy='114' rx='30' ry='20' fill={HILITE} />
                {/* soft raised brows — friendly arch, not a stern down-angled V */}
                <Path d='M70,73 Q80,67 90,73' stroke={SHADE} strokeWidth='3.5' strokeLinecap='round' fill='none' />
                <Path d='M130,73 Q120,67 110,73' stroke={SHADE} strokeWidth='3.5' strokeLinecap='round' fill='none' />
                {/* big round eyes with a bright sparkle — reads warm */}
                <Ellipse cx='80' cy='91' rx='9' ry='10' fill='#1F2937' />
                <Ellipse cx='120' cy='91' rx='9' ry='10' fill='#1F2937' />
                <Circle cx='83' cy='87' r='3.2' fill='#FFFFFF' />
                <Circle cx='123' cy='87' r='3.2' fill='#FFFFFF' />
                <Circle cx='77' cy='94' r='1.6' fill='#FFFFFF' />
                <Circle cx='117' cy='94' r='1.6' fill='#FFFFFF' />
                {/* nose */}
                <Path
                    d='M100,116 C92,116 88,110 92,106 C95,103 100,104 100,104 C100,104 105,103 108,106 C112,110 108,116 100,116 Z'
                    fill='#1F2937'
                />
                {/* simple soft smile — short philtrum + a single gentle upward curve */}
                <Path
                    d='M100,117 L100,124 M85,127 Q100,138 115,127'
                    stroke='#1F2937'
                    strokeWidth='3'
                    strokeLinecap='round'
                    fill='none'
                />

                {/* paw gripping the mic (fur) */}
                <Path
                    d='M140,124 C138,114 146,108 154,110 C162,112 164,120 160,126 C156,132 144,132 140,124 Z'
                    fill={fur}
                />

                {/* ---- MIC (mic) — retro ball microphone ---- */}
                {/* handle (neutral, not recolored) */}
                <Line x1='150' y1='124' x2='163' y2='101' stroke='#374151' strokeWidth='7' strokeLinecap='round' />
                {/* collar where the grille meets the handle */}
                <Circle cx='165' cy='99' r='5.5' fill='#4B5563' />
                {/* grille ball */}
                <Ellipse cx='169' cy='86' rx='15' ry='15' fill={mic} />
                {/* form shadow on the lower-right of the ball */}
                <Ellipse cx='172' cy='89' rx='12' ry='12' fill={SHADE} opacity={0.3} />
                {/* grille mesh lines */}
                <Path d='M157,84 Q169,80 181,84' stroke={SHADE} strokeWidth='1.6' strokeLinecap='round' fill='none' />
                <Path d='M163,73 Q160,86 165,98' stroke={SHADE} strokeWidth='1.6' strokeLinecap='round' fill='none' />
                <Path d='M176,73 Q179,86 173,98' stroke={SHADE} strokeWidth='1.6' strokeLinecap='round' fill='none' />
                {/* specular highlight */}
                <Circle cx='162' cy='80' r='4' fill={HILITE} />
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
