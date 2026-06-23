import { getDeviceId } from '../challenge/deviceId';
import { BlockedError } from '../challenge/store';
import { getChallengeNickname } from '../challenge/nickname';
import { loadStats, signatureSlug } from '../progression';
import { ALLTIME_PERIOD, monthBucketId, RANKED_GAMES, type RankedGame, type RankingScope } from './config';
import { qualifies } from './rank';
import { recordBestIfHigher, markSynced, listPending } from './local';
import { countEntries, lowestScore, submitEntry } from './store';
import { invalidateGameCache } from './cache';
import type { RankingEntry } from './types';

// Orchestrates pushing a device's best challenge score to the global board
// (ADR-0004). Best-effort and non-blocking: a failed push leaves the best
// `pending` locally and is retried on app open and when the rankings view
// opens. Idempotent — re-pushing a best just re-asserts it (best-only rule).

/**
 * Try to write a score into one bucket. Reads the bucket's count + lowest score
 * to self-gate (`qualifies`): a full bucket only accepts a higher score, so we
 * never create a sub-cutoff entry the cleanup script would just rotate out.
 * Returns whether the local best can be considered resolved (`true`) or should
 * stay pending for retry (`false`, i.e. the network call failed).
 */
async function pushToBucket(game: string, period: string, score: number, nickname: string): Promise<boolean> {
    try {
        const [count, lowest] = await Promise.all([countEntries(game, period), lowestScore(game, period)]);
        if (!qualifies(count, lowest ?? 0, score)) return true; // doesn't qualify — terminal, nothing to write
        const entry: RankingEntry = { nickname, score };
        // System-derived from the player's level at write time. Only set when present
        // so we never write an `undefined` field to Firestore.
        const signature = signatureSlug(loadStats().lifetimeXp);
        if (signature) entry.signature = signature;
        await submitEntry(game, period, getDeviceId(), entry);
        // Our own entry just changed the board; drop the day cache so the next
        // rankings open pulls fresh and shows the new standing.
        invalidateGameCache(game);
        return true;
    } catch (err) {
        // A `BlockedError` (permission-denied / App Check) is a terminal server
        // rejection — a retry can never succeed, so resolve it locally instead of
        // re-queuing it forever. Only a genuine offline blip stays pending.
        return err instanceof BlockedError;
    }
}

/** Push a just-finished challenge run's score to the all-time + current-month
 * boards, for each scope it set a new local best. */
export async function pushRanking(game: string, score: number, nickname: string): Promise<void> {
    if (!RANKED_GAMES.includes(game as RankedGame)) return; // only the three live games have a board
    const monthId = monthBucketId();
    const scopes: { scope: RankingScope; period: string }[] = [
        { scope: 'alltime', period: ALLTIME_PERIOD },
        { scope: 'month', period: monthId },
    ];
    // The two buckets are independent, so push them concurrently. The synchronous
    // `recordBestIfHigher` runs to completion before each await, so the shared
    // local state is still written without races.
    await Promise.all(
        scopes.map(async ({ scope, period }) => {
            if (!recordBestIfHigher(game, scope, score, monthId)) return;
            if (await pushToBucket(game, period, score, nickname)) markSynced(game, scope);
        }),
    );
}

/** Retry every locally-pending best (app open / rankings view open). */
export async function retryPending(): Promise<void> {
    const nickname = getChallengeNickname();
    if (!nickname) return; // nothing to attribute a write to yet
    const currentMonth = monthBucketId();
    for (const p of listPending()) {
        if (p.scope === 'month') {
            // A month bucket only accepts the server's current month; a pending
            // best from a past month can never be written — give up on it.
            if (p.monthId !== currentMonth) {
                markSynced(p.game, 'month');
                continue;
            }
        }
        const period = p.scope === 'alltime' ? ALLTIME_PERIOD : currentMonth;
        if (await pushToBucket(p.game, period, p.score, nickname)) markSynced(p.game, p.scope);
    }
}
