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
import Svg, { Defs, Pattern, Path, Circle, Polygon, Ellipse, Line } from 'react-native-svg';
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
// Suit outline — a darker border on the jacket + same-colored sleeves so the raised
// arms read as distinct limbs, not a flat shadow. Semi-transparent black → darkens
// ANY resolved suit colour, so it is NEVER recolored (same seam rule as SHADE/HILITE).
const OUTLINE = 'rgba(0,0,0,0.32)';

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
 * on a real device. The Phase 6 fox (two-handed mic pose) draws ~39 nodes; the
 * ceiling is 52 — these are cheap static shapes (only the outer group is animated
 * by transform), so the headroom is safe. Beyond it, re-measure on a low-end device.
 */
export const MASCOT_NODE_CEILING = 52;

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

    // Unique per-instance id so the grille pattern never collides across multiple
    // mounted mascots (Home overlay + a Results screen, etc.).
    const grilleId = 'micGrille' + React.useId().replace(/:/g, '');

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
                    stroke={OUTLINE} strokeWidth='2' strokeLinejoin='round'
                />
                {/* cream fox tail tip — SOLID (never ghosts) + bounded inside the curl so it
                    can't spill onto the background. Caps the whole END of the curl (the last
                    third); the inner separation is a soft curve, not a straight cut. */}
                <Path d='M21,137 C23,119 38,111 47,116 C44,122 41,129 41,139 C34,145 27,144 21,137 Z' fill='#F8E6CE' stroke={OUTLINE} strokeWidth='2' strokeLinejoin='round' />
                {/* darker base where the tail tucks behind the body — gives the curl depth */}
                <Path d='M52,168 C58,176 64,180 68,178 L60,182 C54,180 50,174 52,168 Z' fill={SHADE} />

                {/* ---- SUIT body (suit) — tailored jacket, with a darker OUTLINE border so the
                    same-colored raised arms below read as distinct limbs ---- */}
                <Path
                    d='M82,130 C64,134 52,146 48,166 L44,206 Q44,213 54,213 L146,213 Q156,213 156,206 L152,166 C148,146 136,134 118,130 Z'
                    fill={suit}
                    stroke={OUTLINE}
                    strokeWidth='2'
                />
                {/* arms + hands are drawn together with the mic below, so they sit in front of the tie */}
                {/* lapels (suit) — open V over the chest (no OUTLINE border: the triangle edges
                    read as stray diagonal lines; the silhouette + arm borders are enough) */}
                <Polygon points='82,130 60,150 90,182 98,140' fill={suit} />
                <Polygon points='118,130 140,150 110,182 102,140' fill={suit} />
                {/* lapel inner shadow */}
                <Polygon points='98,140 90,182 96,182 100,146' fill={SHADE} />
                {/* white chest fluff at the collar */}
                <Polygon points='90,132 110,132 100,146' fill={HILITE} />

                {/* ---- ACCENT tie ---- */}
                <Path d='M100,138 L108,146 L106,156 L112,194 L100,202 L88,194 L94,156 L92,146 Z' fill={accent} stroke={OUTLINE} strokeWidth='2' strokeLinejoin='round' />
                <Polygon points='100,156 112,194 100,202' fill={SHADE} />

                {/* ---- EARS (fur) — full rounded-triangular fox ears (convex sides, soft tip);
                    both bottom corners tuck inside the head so there's no protruding flap/notch ---- */}
                <Path d='M60,74 C51,58 48,42 54,34 C58,30 63,32 66,42 C70,54 78,62 86,66 Z' fill={fur} stroke={OUTLINE} strokeWidth='2' strokeLinejoin='round' />
                <Path d='M140,74 C149,58 152,42 146,34 C142,30 137,32 134,42 C130,54 122,62 114,66 Z' fill={fur} stroke={OUTLINE} strokeWidth='2' strokeLinejoin='round' />
                {/* inner ear (rounded triangle inset) */}
                <Path d='M60,66 C54,54 55,44 60,40 C64,48 72,58 80,64 Z' fill={SHADE} />
                <Path d='M140,66 C146,54 145,44 140,40 C136,48 128,58 120,64 Z' fill={SHADE} />

                {/* ---- HEAD (fur) — fox: wide cheek ruffs tapering to a narrow pointed snout ---- */}
                <Path
                    d='M100,50 C82,48 60,54 54,74 C48,90 48,102 56,110 C66,126 80,136 100,144 C120,136 134,126 144,110 C152,102 152,90 146,74 C140,54 118,48 100,50 Z'
                    fill={fur}
                    stroke={OUTLINE} strokeWidth='2' strokeLinejoin='round'
                />
                {/* muzzle/snout highlight — a narrow teardrop that juts down (fox snout) */}
                <Path
                    d='M100,102 C87,102 81,113 85,125 C89,135 96,141 100,141 C104,141 111,135 115,125 C119,113 113,102 100,102 Z'
                    fill={HILITE}
                />
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
                {/* nose — on the front of the snout */}
                <Path
                    d='M100,124 C92,124 88,118 92,114 C95,111 100,112 100,112 C100,112 105,111 108,114 C112,118 108,124 100,124 Z'
                    fill='#1F2937'
                />
                {/* simple soft smile — short philtrum + a single gentle upward curve */}
                <Path
                    d='M100,124 L100,130 M88,132 Q100,140 112,132'
                    stroke='#1F2937'
                    strokeWidth='3'
                    strokeLinecap='round'
                    fill='none'
                />

                {/* ---- MIC (mic) — retro ball mic held low at collar height in the right paw ---- */}
                <Defs>
                    {/* grille holes as a tiled dot pattern → reads on ANY mic colour, few nodes */}
                    <Pattern id={grilleId} patternUnits='userSpaceOnUse' width='2.9' height='2.9'>
                        <Circle cx='1.45' cy='1.45' r='0.7' fill='rgba(0,0,0,0.34)' />
                    </Pattern>
                </Defs>
                {/* right arm — ONE chunky suit sleeve from the shoulder down to the paw that grips
                    the mic. Solid suit fill + the jacket OUTLINE border so it reads as a real raised
                    limb, not a shadow. Drawn behind the mic + hand; stays right of the tie. */}
                <Path
                    d='M120,162 C130,162 142,166 149,174 C153,179 151,187 145,187 C136,186 126,180 119,176 C114,173 114,164 120,162 Z'
                    fill={suit}
                    stroke={OUTLINE}
                    strokeWidth='2'
                />
                {/* HILITE down the raised forearm → a lighter tone than the flat jacket so it reads
                    as a rounded limb in FRONT of the body, not just an outline/cord */}
                <Path
                    d='M122,165 C131,165 141,169 147,176 C150,180 148,185 143,185 C135,184 127,179 121,175 C117,172 117,166 122,165 Z'
                    fill={HILITE}
                />
                {/* handle (neutral) — slim rounded stub, mostly hidden behind the paw */}
                <Line x1='124' y1='164' x2='123' y2='181' stroke='#374151' strokeWidth='5' strokeLinecap='round' />
                {/* grille ball (base colour + rim) — low at the collar, right of the tie, clear of the smile */}
                <Circle cx='126' cy='150' r='15' fill={mic} stroke={OUTLINE} strokeWidth='2' />
                {/* form shadow lower-right for roundness (under the holes) */}
                <Circle cx='130' cy='154' r='12' fill={SHADE} opacity={0.22} />
                {/* perforated grille — lots of little holes */}
                <Circle cx='126' cy='150' r='15' fill={`url(#${grilleId})`} />
                {/* specular highlight */}
                <Circle cx='119' cy='143' r='4.5' fill={HILITE} />
                {/* right paw (fur) gripping the mic handle just below the ball */}
                <Path
                    d='M114,170 C112,162 120,157 127,161 C133,164 133,173 128,177 C122,181 116,177 114,170 Z'
                    fill={fur}
                    stroke={OUTLINE} strokeWidth='2' strokeLinejoin='round'
                />
                {/* finger creases so the paw reads as a gripping hand */}
                <Path
                    d='M120,163 L119,172 M125,164 L124,173'
                    stroke={SHADE}
                    strokeWidth='1.6'
                    strokeLinecap='round'
                    fill='none'
                />
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
