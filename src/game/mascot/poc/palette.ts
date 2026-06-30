/**
 * THROWAWAY PoC palette (plan §2 Sequencing Gate). Proves the data shape that
 * Phase 1 will harden: a "look" is a `{ slot: colorId }` map, ownership-agnostic,
 * recolored by overriding the `fill` of each named SVG region at runtime.
 *
 * Stable string color IDs (plan §7.1) — these are the IDs that will eventually
 * travel in the challenge payload, so even in the PoC we use strings, never
 * array indices. Unknown IDs fall back to the slot default (plan §7.3).
 *
 * Delete this whole folder once the gate is verified on a real device and the
 * real Phase 1 data model lands.
 */

/** The four recolorable regions. */
export type MascotSlot = 'fur' | 'suit' | 'accent' | 'mic';

/** The four reaction poses (plan §3). `jackpot` is deferred. */
export type MascotPose = 'intro' | 'idle' | 'cheer' | 'dismay';

/** A look = one colorId per slot. Serializes to the challenge payload in v2. */
export type LookMap = Record<MascotSlot, string>;

/** Placeholder palette: 3 colors per slot (plan §8 — generic until base art exists). */
export const POC_PALETTE: Record<MascotSlot, { id: string; hex: string }[]> = {
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
    fur: POC_PALETTE.fur[0].id,
    suit: POC_PALETTE.suit[0].id,
    accent: POC_PALETTE.accent[0].id,
    mic: POC_PALETTE.mic[0].id,
};

/**
 * Resolve a slot's colorId to a hex. Unknown IDs (older app / newer color) fall
 * back to the slot default — the render path never crashes on a bad map (§7.3).
 */
export function resolveSlotColor(slot: MascotSlot, colorId: string): string {
    const swatches = POC_PALETTE[slot];
    const match = swatches.find((s) => s.id === colorId);
    return (match ?? swatches[0]).hex;
}
