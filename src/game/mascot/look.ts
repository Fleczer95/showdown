/**
 * Mascot look — the permanent data model (plan §5, §7). A "look" is a
 * `{ slot: colorId }` map: ownership-agnostic, recolored at render time by
 * overriding the `fill` of each named SVG region.
 *
 * Stable string color IDs (plan §7.1) — these IDs travel in the ADR-0003
 * challenge payload, so they must NEVER be renumbered. Unknown IDs (an older
 * app, or a color a recipient lacks) fall back to the slot default (plan §7.3),
 * so the render path never crashes on a bad map.
 *
 * This file is the canonical palette. The throwaway PoC harness
 * (`src/game/mascot/poc/`) and the real customizer both read from here.
 */

/** The four recolorable regions. */
export type MascotSlot = 'fur' | 'suit' | 'accent' | 'mic';

/** The four reaction poses (plan §3). `jackpot` is deferred. */
export type MascotPose = 'intro' | 'idle' | 'cheer' | 'dismay';

/** A look = one colorId per slot. Serializes to the challenge payload in v2. */
export type LookMap = Record<MascotSlot, string>;

/** One selectable color. `id` is the stable, never-renumbered colorId (plan §7.1). */
export interface MascotSwatch {
    id: string;
    hex: string;
}

/**
 * Placeholder palette: 3 colors per slot (plan §8 — generic until the polished
 * base art exists). The first swatch of every slot is the free default; the rest
 * are sold as the single bundle (see `src/data/store/mascotSkins.ts`). IDs are
 * carried over verbatim from the device-verified PoC — do not renumber (§7.1).
 */
export const MASCOT_PALETTE: Record<MascotSlot, MascotSwatch[]> = {
    fur: [
        { id: 'fur.orange', hex: '#F2780C' },
        { id: 'fur.rust', hex: '#C2410C' },
        { id: 'fur.arctic', hex: '#E2E8F0' },
    ],
    suit: [
        { id: 'suit.royal', hex: '#1D4ED8' },
        { id: 'suit.emerald', hex: '#047857' },
        { id: 'suit.plum', hex: '#7E22CE' },
    ],
    accent: [
        { id: 'accent.crimson', hex: '#DC2626' },
        { id: 'accent.gold', hex: '#F59E0B' },
        { id: 'accent.teal', hex: '#0D9488' },
    ],
    mic: [
        { id: 'mic.gold', hex: '#FBBF24' },
        { id: 'mic.silver', hex: '#CBD5E1' },
        { id: 'mic.rose', hex: '#FB7185' },
    ],
};

/** The default look — first color of every slot. The unknown-ID fallback target. */
export const DEFAULT_LOOK: LookMap = {
    fur: MASCOT_PALETTE.fur[0].id,
    suit: MASCOT_PALETTE.suit[0].id,
    accent: MASCOT_PALETTE.accent[0].id,
    mic: MASCOT_PALETTE.mic[0].id,
};

/**
 * Resolve a slot's colorId to a hex. Unknown IDs (older app / newer color) fall
 * back to the slot default — the render path never crashes on a bad map (§7.3).
 */
export function resolveSlotColor(slot: MascotSlot, colorId: string): string {
    const swatches = MASCOT_PALETTE[slot];
    const match = swatches.find((s) => s.id === colorId);
    return (match ?? swatches[0]).hex;
}
