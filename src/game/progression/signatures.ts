// Earned SIGNATURE definitions — a single emoji shown next to the player's
// nickname on both ranking boards, earned by climbing the Level Map. Like
// PROGRESSION_THEMES, these live OUTSIDE the commercial STORE_CATALOG (never
// sold, no IAP/SKU contamination) and bind a reward id (matching a LEVEL_MAP
// node) to a presentation.
//
// Board entries store the stable `slug`, never the glyph; `signatureEmoji`
// resolves slug -> emoji at render time. The emoji character is defined once
// here and turned into pixels once in <Glyph>, so the planned emoji -> SVG
// migration touches only those two seams.

import { unlockedRewards } from './map';

export interface Signature {
    /** Reward id — matches a LEVEL_MAP node `rewardId` and `unlockedRewards()`. */
    id: string;
    /** Stable ASCII slug stored on board entries (the id without the 'signature-' prefix). */
    slug: string;
    /** v1 presentation: the emoji the slug resolves to. */
    emoji: string;
    titleKey: string;
    /** The LEVEL_MAP node level this signature is bound to. */
    level: number;
}

// Ascending by level — `signatureSlug` relies on this order to pick the top tier.
export const SIGNATURES: readonly Signature[] = [
    { id: 'signature-sprout', slug: 'sprout', emoji: '🌱', titleKey: 'progression.signatures.sprout', level: 5 },
    { id: 'signature-spark', slug: 'spark', emoji: '⚡', titleKey: 'progression.signatures.spark', level: 10 },
    { id: 'signature-fire', slug: 'fire', emoji: '🔥', titleKey: 'progression.signatures.fire', level: 20 },
    { id: 'signature-gem', slug: 'gem', emoji: '💎', titleKey: 'progression.signatures.gem', level: 25 },
    { id: 'signature-star', slug: 'star', emoji: '🌟', titleKey: 'progression.signatures.star', level: 40 },
    { id: 'signature-crown', slug: 'crown', emoji: '👑', titleKey: 'progression.signatures.crown', level: 50 },
];

/** Allowlist of every known signature slug (Firestore rule validation + tests). */
export const SIGNATURE_SLUGS: readonly string[] = SIGNATURES.map((s) => s.slug);

/**
 * The highest-tier signature slug earned at `lifetimeXp`, or undefined below the
 * first tier. Derived from `unlockedRewards` (the same reached-rewardId source the
 * map uses), so it is pure, retroactive, and only counts signatures actually wired
 * onto a LEVEL_MAP node.
 */
export function signatureSlug(lifetimeXp: number): string | undefined {
    const earned = unlockedRewards(lifetimeXp);
    let best: string | undefined;
    for (const s of SIGNATURES) {
        if (earned.has(s.id)) best = s.slug; // ascending order ⇒ last match is the top tier
    }
    return best;
}

const EMOJI_BY_SLUG = new Map(SIGNATURES.map((s) => [s.slug, s.emoji]));

/** Resolve a stored slug to its emoji character (render-time only; the migration seam). */
export function signatureEmoji(slug: string | undefined): string | undefined {
    return slug ? EMOJI_BY_SLUG.get(slug) : undefined;
}
