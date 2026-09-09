/**
 * Prizes are awarded in the order the edition lists them: `prizePool` IS the
 * ladder, so the first entry is what a player earns at the first milestone.
 *
 * Deliberately not random and not keyed on the player. Two devices sharing one
 * cloud save can each reach a milestone while offline, and mergeStats unions
 * `earnedRewardIds` — so if they picked different prizes for the same draw the
 * player would end up holding both, one milestone with two rewards. Any
 * per-player seed has that flaw: the only ids stable enough to seed with
 * (deviceId) are deliberately excluded from native backup, and a seed stored in
 * progression would itself diverge before the two saves ever met.
 *
 * A fixed order makes that impossible with nothing extra persisted anywhere,
 * and it puts which prize sits at which milestone under editorial control.
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
        // Declaration order is the ladder; the first prize not yet held is next.
        const rewardId = pool.find((id) => !taken.has(id));
        if (rewardId === undefined) break;
        taken.add(rewardId);
        out.push({ grantId, rewardId });
    }
    return out;
}
