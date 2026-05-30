// ── Fluid responsive scaling ──────────────────────────────────────
//
// Single source of truth for how design tokens grow/shrink with screen
// size. Driven by the *shortest side* (in pt) so portrait and landscape
// of the same device scale identically.
//
// The curve is continuous (no hard jump at the tablet breakpoint):
//   - factor === 1 at the phone baseline (380pt)
//   - grows toward each ceiling as the device approaches tablet width
//   - shrinks toward each floor on very small phones
//
// Ceilings/floors preserve the previous discrete behaviour so existing
// tablet layouts don't regress.

const PHONE_BASE = 380; // factor = 1 here (reference phone)
const TABLET_FULL = 840; // ceilings reached at/after this shortest side
const COMPACT_FULL = 320; // floors reached at/below this shortest side

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v));
}

/** Upward progress 0→1 as the device grows from phone baseline to tablet. */
export function tabletProgress(shortestSide: number): number {
    return clamp((shortestSide - PHONE_BASE) / (TABLET_FULL - PHONE_BASE), 0, 1);
}

/** Downward progress 0→1 as the device shrinks from phone baseline to compact. */
function compactProgress(shortestSide: number): number {
    return clamp((PHONE_BASE - shortestSide) / (PHONE_BASE - COMPACT_FULL), 0, 1);
}

/** Continuous scaling factor between a compact floor (`min`) and a tablet ceiling (`max`). */
function factor(shortestSide: number, max: number, min: number): number {
    return shortestSide >= PHONE_BASE
        ? 1 + (max - 1) * tabletProgress(shortestSide)
        : 1 - (1 - min) * compactProgress(shortestSide);
}

/** Typography scale: 0.85 (compact) → 1 (phone) → 1.5 (tablet). */
export const typeScaleFactor = (shortestSide: number): number => factor(shortestSide, 1.5, 0.85);

/** Spacing scale: 0.9 (compact) → 1 (phone) → 1.3 (tablet). */
export const spaceScaleFactor = (shortestSide: number): number => factor(shortestSide, 1.3, 0.9);

/** Icon scale: 1 (phone & compact, kept legible) → 1.45 (tablet). */
export const iconScaleFactor = (shortestSide: number): number => factor(shortestSide, 1.45, 1.0);
