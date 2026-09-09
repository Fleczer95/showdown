/**
 * Prize selection is a pure function of the edition and the pool — never a call
 * to Math.random, and deliberately NOT keyed on the player.
 *
 * Two devices sharing one cloud save can each reach a milestone while offline.
 * mergeStats unions `earnedRewardIds`, so if they drew different prizes for the
 * same draw the player would end up holding both — one milestone, two rewards.
 * Any per-player seed has that flaw, because the only ids stable enough to seed
 * with (deviceId) are deliberately excluded from backup, and a seed stored in
 * progression would itself diverge before the two saves ever met.
 *
 * So the draw order is fixed per edition: every device computes the same prize
 * for the same draw, with nothing extra persisted anywhere. Players still cannot
 * predict it — the pool order is not the declaration order — they simply share it.
 */

export interface DrawInput {
    editionId: string;
    pool: readonly string[];
    winsPerPrize: number;
    wins: number;
    /** Grant identities already recorded in `eventRewardGrants`. */
    grantedDraws: readonly string[];
    /** `earnedRewardIds` — a pool item in here is never drawn again. */
    alreadyEarned: readonly string[];
}

/** FNV-1a, reduced to an index. Stable across devices and app versions. */
export function seededIndex(seed: string, count: number): number {
    if (count <= 0) return -1;
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash % count;
}

/** Grant identity for the nth prize of an edition. */
export function drawIdentity(editionId: string, draw: number): string {
    return `${editionId}/draw-${draw}`;
}

/** The prizes owed for `wins` that have not been granted yet. */
export function drawPrizes(input: DrawInput): { grantId: string; rewardId: string }[] {
    const { editionId, pool, winsPerPrize, wins } = input;
    if (winsPerPrize < 1) return [];
    const granted = new Set(input.grantedDraws);
    const taken = new Set(input.alreadyEarned);
    const out: { grantId: string; rewardId: string }[] = [];
    for (let draw = 1; draw <= Math.floor(wins / winsPerPrize); draw++) {
        const grantId = drawIdentity(editionId, draw);
        // An already-granted draw's reward is in `taken`, so it stays excluded.
        if (granted.has(grantId)) continue;
        // Sorted so the outcome cannot depend on how the pool was declared.
        const remaining = [...pool].filter((id) => !taken.has(id)).sort();
        if (remaining.length === 0) break;
        const rewardId = remaining[seededIndex(`${editionId}:${draw}`, remaining.length)];
        taken.add(rewardId);
        out.push({ grantId, rewardId });
    }
    return out;
}
