// Earned mascot color definitions. Like PROGRESSION_THEMES and SIGNATURES, these
// live OUTSIDE the commercial STORE_CATALOG (never sold, no IAP/SKU contamination)
// and bind a reward id (matching a LEVEL_MAP node) to a palette colorId. The
// SWATCH itself (the hex) lives in src/game/mascot/look.ts like every other color;
// here we only mark which colorId is earned-not-bought and how it presents on the
// Level Map.

import type { MascotSlot } from '../mascot/look';

export interface ProgressionMascotColor {
    /** Reward id — matches a LEVEL_MAP node `rewardId` and `unlockedRewards()`. */
    id: string;
    /** The slot this color belongs to. */
    slot: MascotSlot;
    /** The palette colorId unlocked (stable, never renumbered — plan §7.1). */
    colorId: string;
    titleKey: string;
}

export const PROGRESSION_MASCOT_COLORS: readonly ProgressionMascotColor[] = [
    {
        id: 'mascot-mic-platinum',
        slot: 'mic',
        colorId: 'mic.platinum',
        titleKey: 'progression.mascotColors.platinumMic',
    },
];

/** Every earned colorId — excluded from the purchasable bundle so it reads as earned, not buyable. */
export const EARNED_MASCOT_COLOR_IDS: ReadonlySet<string> = new Set(PROGRESSION_MASCOT_COLORS.map((c) => c.colorId));
