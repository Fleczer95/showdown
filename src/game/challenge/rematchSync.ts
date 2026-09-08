import { getDeviceId } from './deviceId';
import {
    listChallenges,
    markChallengeOpponentPlayed,
    markEventOpponentJoined,
    markChallengePlayed,
    recordChallenge,
    type ChallengeStub,
} from './log';
import { syncChallengeStatuses, syncRematches } from './store';
import { recoverCompletions } from './session/recovery';
import { resolveEventOutcomes } from '../events/resolveOutcomes';
import { SafeSentry } from '../../utils/sentry/init';

/**
 * Refresh status and pull directed successors for challenge ids already indexed
 * on this device, then merge both into the offline-first History log. The small
 * interface keeps network shape and MMKV dedupe out of Home/History.
 */
export async function syncIncomingRematches(): Promise<ChallengeStub[]> {
    void recoverCompletions().catch((error) =>
        SafeSentry.captureException(error, { tags: { area: 'challenge-recovery' } }),
    );
    const known = listChallenges();
    const sourceIds = known.map((challenge) => challenge.id);
    if (sourceIds.length === 0) return [];

    const deviceId = getDeviceId();
    const batches: string[][] = [];
    for (let i = 0; i < sourceIds.length; i += 100) batches.push(sourceIds.slice(i, i + 100));
    const [incomingResult, statusesResult] = await Promise.allSettled([
        Promise.all(batches.map((ids) => syncRematches(deviceId, ids))).then((rows) => rows.flat()),
        Promise.all(batches.map((ids) => syncChallengeStatuses(deviceId, ids))).then((rows) => rows.flat()),
    ]);
    if (incomingResult.status === 'rejected' && statusesResult.status === 'rejected') {
        throw incomingResult.reason;
    }

    // Discovery and status refresh are independent. A transient failure in one
    // must not discard useful state returned by the other.
    const incoming = incomingResult.status === 'fulfilled' ? incomingResult.value : [];
    const statuses = statusesResult.status === 'fulfilled' ? statusesResult.value : [];
    for (const status of statuses) {
        if (status.opponentJoined !== undefined) markEventOpponentJoined(status.id, status.opponentJoined);
        if (status.played) markChallengePlayed(status.id);
        if (status.opponentPlayed) markChallengeOpponentPlayed(status.id);
    }
    // Statuses have just told us who else has played; settle any event verdict
    // that became knowable. Failures are contained per round inside.
    await resolveEventOutcomes().catch((error) =>
        SafeSentry.captureException(error, { tags: { area: 'event-outcomes' } }),
    );
    for (const rematch of incoming) {
        recordChallenge({
            id: rematch.id,
            game: rematch.game,
            role: 'received',
            opponent: rematch.senderNickname,
            played: false,
            expiresAt: rematch.expiresAt,
            isRematch: true,
            sourceChallengeId: rematch.sourceChallengeId,
        });
    }

    const incomingIds = new Set(incoming.map((rematch) => rematch.id));
    return listChallenges().filter((challenge) => incomingIds.has(challenge.id));
}
