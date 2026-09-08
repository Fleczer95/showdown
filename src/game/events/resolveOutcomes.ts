import { findEdition } from '../../../shared/events/definitions';
import { listChallenges, markChallengeOutcome } from '../challenge/log';
import { challengeOutcome } from '../challenge/outcome';
import { getAttempts, getAttempt } from '../challenge/store';
import { getDeviceId } from '../challenge/deviceId';
import { listSessions } from '../challenge/session/store';
import { recordEventWin } from '../progression/recordRun';

/**
 * This device's own attempt timestamp for a challenge. The session journal is
 * cheap and usually has it, but it is capped at 50 entries and does not protect
 * a completed, settled, uploaded session — so an early event round's session
 * can be pruned once later challenges pile up. When that happens, fall back to
 * the server, which still has our own attempt as authoritative.
 */
async function myTimestamp(challengeId: string, deviceId: string): Promise<number | null> {
    const local = listSessions().find((s) => s.challengeId === challengeId)?.attempt?.timestamp;
    if (local !== undefined) return local;
    return (await getAttempt(challengeId, deviceId))?.timestamp ?? null;
}

/**
 * Settle event rounds whose verdict is still unknown, and award any prize the
 * new wins unlock.
 *
 * Two resolution paths, and only one of them costs a request:
 *  - the opponent has uploaded (the statuses sync already told us), so compare;
 *  - the event has closed and no opponent ever uploaded, so it is a walkover.
 * A round with no opponent yet, mid-event, is left alone.
 */
export async function resolveEventOutcomes(now: number = Date.now()): Promise<string[]> {
    const deviceId = getDeviceId();
    const granted: string[] = [];
    for (const stub of listChallenges()) {
        if (!stub.eventId || stub.outcome || !stub.played) continue;
        const edition = findEdition(stub.eventId, true);
        if (!edition) continue;
        let outcome: 'won' | 'lost' | 'draw' | 'pending' = 'pending';
        if (stub.opponentPlayed) {
            try {
                outcome = challengeOutcome(await getAttempts(stub.id), await myTimestamp(stub.id, deviceId));
            } catch {
                // Offline or a transient failure. Leave it unresolved; the next
                // sync retries it. One bad round must not stop the others.
                continue;
            }
        } else if (edition.endsAt !== undefined && now >= edition.endsAt) {
            // Closure walkover: nobody ever came, so the round is won.
            outcome = 'won';
        }
        if (outcome === 'pending') continue;
        // Record the win before marking the outcome: both are guarded against
        // repeats, so an app kill between them must not drop the win — a kill
        // after recordEventWin just re-resolves (a no-op) on the next sync.
        if (outcome === 'won') granted.push(...recordEventWin(edition, stub.id, deviceId));
        markChallengeOutcome(stub.id, outcome);
    }
    return granted;
}
