import {
    eventDailyCap,
    eventLifecycle,
    findEdition,
    EVENT_UPLOAD_WINDOW_MS,
    type EventEdition,
} from '../../../shared/events/definitions';
import { premiumItemsOwned } from '../challenge/limit';
import { getDeviceId, generateUuid } from '../challenge/deviceId';
import { request, getChallenge, BlockedError } from '../challenge/store';
import {
    getPendingEventStart,
    setPendingEventStart,
    clearPendingEventStart,
    eventUsage,
    startSession,
    type PendingEventStart,
} from '../challenge/session/store';
import { initialCheckpoint } from '../challenge/session/initial';
import { localDate } from '../progression/recordRun';
import { recordChallenge } from '../challenge/log';
import { getEquippedLook } from '../mascot/equippedLook';
import type { ChallengeLocale, ChallengeRecord } from '../challenge/types';
import { eventQuestions } from './content';

export interface EventEntitlements {
    purchasedIds: ReadonlySet<string>;
    premium: boolean;
}
export function remainingEventPlays(edition: EventEdition, access: EventEntitlements, now = new Date()): number {
    return Math.max(
        0,
        eventDailyCap(edition, premiumItemsOwned(access.purchasedIds), access.premium) -
            eventUsage(edition.id, localDate(now)),
    );
}
let inFlight = false;
/** One pending installation-wide operation, persisted before sending any request. */
export async function startEvent(input: {
    edition: EventEdition;
    mode: 'friend' | 'random';
    nickname: string;
    locale: ChallengeLocale;
    entitlements: () => EventEntitlements;
    challengeId?: string;
    record?: ChallengeRecord;
}): Promise<{ id: string; share: boolean }> {
    if (inFlight) throw new Error('Event start already in progress');
    inFlight = true;
    try {
        let pending = getPendingEventStart();
        if (pending && pending.editionId !== input.edition.id) throw new Error('Resolve pending event start first');
        const edition = pending ? findEdition(pending.editionId, true)! : input.edition;
        if (!pending) {
            if (eventLifecycle(edition, Date.now()) !== 'active') throw new BlockedError(undefined, 410);
            if (remainingEventPlays(edition, input.entitlements()) <= 0) throw new Error('Event allowance exhausted');
            const activity = edition.activities[0];
            const record: ChallengeRecord = input.record ?? {
                lang: input.locale,
                game: activity.game,
                questions: eventQuestions(activity.contentRevision),
                createdBy: { uuid: getDeviceId(), nickname: input.nickname },
                mascot: getEquippedLook(),
                expiresAt: edition.endsAt! + EVENT_UPLOAD_WINDOW_MS,
                event: {
                    editionId: edition.id,
                    contentRevision: activity.contentRevision,
                    mode: input.mode,
                    endsAt: edition.endsAt!,
                },
            };
            pending = {
                requestId: generateUuid(),
                editionId: edition.id,
                game: record.game,
                mode: input.mode,
                record,
                nickname: input.nickname,
                challengeId: input.challengeId,
            } satisfies PendingEventStart;
            setPendingEventStart(pending);
        }
        // Even if local time crossed midnight/closure, resolve the same uncertain
        // admission before allowing a second start. No charge happens over HTTP.
        let admitted: { id: string };
        try {
            admitted = await request<{ id: string }>('/events/start', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: pending.requestId,
                    uuid: getDeviceId(),
                    record: pending.record,
                    challengeId: pending.challengeId,
                }),
            });
        } catch (error) {
            if (error instanceof BlockedError && [400, 409, 410].includes(error.status ?? 0))
                clearPendingEventStart(pending.requestId);
            throw error;
        }
        if (eventLifecycle(edition, Date.now()) !== 'active') {
            clearPendingEventStart(pending.requestId);
            throw new BlockedError(undefined, 410);
        }
        const record = await getChallenge(admitted.id);
        if (!record?.event || record.event.editionId !== edition.id) throw new Error('Invalid admitted event');
        const access = input.entitlements();
        startSession(
            {
                challengeId: admitted.id,
                deviceId: getDeviceId(),
                record,
                nickname: pending.nickname,
                // Creators get the same Start / Play later choice as ordinary
                // async challenges. A recipient already chose Start to admit.
                ...(pending.mode === 'friend' && !pending.challengeId ? { awaitingStart: true } : {}),
            },
            initialCheckpoint(record, input.locale),
            {
                date: localDate(),
                cap: eventDailyCap(edition, premiumItemsOwned(access.purchasedIds), access.premium),
                requestId: pending.requestId,
            },
        );
        clearPendingEventStart(pending.requestId);
        recordChallenge({
            id: admitted.id,
            game: record.game,
            role: record.createdBy.uuid === getDeviceId() ? 'created' : 'received',
            opponent: record.createdBy.uuid === getDeviceId() ? '' : record.createdBy.nickname,
            played: false,
            expiresAt: record.expiresAt,
            eventId: edition.id,
        });
        return { id: admitted.id, share: pending.mode === 'friend' && !pending.challengeId };
    } finally {
        inFlight = false;
    }
}
