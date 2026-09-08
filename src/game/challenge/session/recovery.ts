import { findEdition } from '../../../../shared/events/definitions';
import { SafeSentry } from '../../../utils/sentry/init';
import { recordRun } from '../../progression/recordRun';
import { pushRanking } from '../../ranking/push';
import { submitAttempt, BlockedError } from '../store';
import { markChallengePlayed } from '../log';
import { getSession, listSessions, updateSessionEffects } from './store';

export function settleCompletion(id: string) {
    const session = getSession(id);
    if (!session?.result || session.completedAt === undefined) return null;
    if (session.effectsSettled) return session.celebration ?? null;
    const edition = session.record.event ? findEdition(session.record.event.editionId, true) : undefined;
    if (session.record.event && !edition) throw new Error('Event definition required to recover completion');
    const diff = recordRun(
        { ...session.result.run, challenge: true },
        {
            id,
            completedAt: session.completedAt,
            edition,
        },
    );
    updateSessionEffects(id, { effectsSettled: true, celebration: diff });
    return diff;
}
export async function uploadCompletion(id: string): Promise<void> {
    const session = getSession(id);
    if (!session?.attempt || !session.result) return;
    // Local progression needs the edition; the attempt upload does not. Never let
    // an unresolvable edition hold back a result the opponent is waiting for.
    try {
        settleCompletion(id);
    } catch (error) {
        SafeSentry.captureException(error, { tags: { area: 'challenge-recovery' } });
    }
    // Rankings have their own persistent retry queue and current-period policy.
    void pushRanking(session.record.game, session.result.run.score, session.attempt.nickname);
    if (session.upload === 'sent' || session.upload === 'closed') return;
    if (Date.now() >= session.record.expiresAt) {
        updateSessionEffects(id, { upload: 'closed' });
        return;
    }
    try {
        await submitAttempt(session.challengeId, session.deviceId, session.attempt);
        updateSessionEffects(id, { upload: 'sent' });
        markChallengePlayed(session.challengeId);
    } catch (error) {
        if (error instanceof BlockedError && (error.status === 409 || error.status === 410 || error.status === 404))
            updateSessionEffects(id, { upload: 'closed' });
        throw error;
    }
}
/** Local effects are synchronous; one offline upload must not block other runs. */
export async function recoverCompletions(): Promise<void> {
    const completed = listSessions().filter((s) => s.status === 'completed');
    for (const s of completed) {
        if (s.effectsSettled) continue;
        try {
            settleCompletion(s.id);
        } catch (error) {
            // A run whose edition no longer resolves must not stop the uploads below.
            SafeSentry.captureException(error, { tags: { area: 'challenge-recovery' } });
        }
    }
    await Promise.allSettled(completed.filter((s) => s.upload === 'pending').map((s) => uploadCompletion(s.id)));
}
