import { getDeviceId } from './deviceId';
import {
    listChallenges,
    markChallengeOpponentPlayed,
    markChallengePlayed,
    recordChallenge,
    type ChallengeStub,
} from './log';
import { syncChallengeStatuses, syncRematches } from './store';

/**
 * Refresh status and pull directed successors for challenge ids already indexed
 * on this device, then merge both into the offline-first History log. The small
 * interface keeps network shape and MMKV dedupe out of Home/History.
 */
export async function syncIncomingRematches(): Promise<ChallengeStub[]> {
    const known = listChallenges();
    const sourceIds = known.map((challenge) => challenge.id);
    if (sourceIds.length === 0) return [];

    const deviceId = getDeviceId();
    const [incoming, statuses] = await Promise.all([
        syncRematches(deviceId, sourceIds),
        syncChallengeStatuses(deviceId, sourceIds),
    ]);
    for (const status of statuses) {
        if (status.played) markChallengePlayed(status.id);
        if (status.opponentPlayed) markChallengeOpponentPlayed(status.id);
    }
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
