import { isChallengeRecord, type ChallengeRecord } from '../../../shared/challenge/contract';
import {
    eventLifecycle,
    findEdition,
    EVENT_UPLOAD_WINDOW_MS,
    validateEdition,
} from '../../../shared/events/definitions';
import { validEventQuestions, eventContent } from '../../../shared/events/content';

export interface EventStartRequest {
    requestId: string;
    uuid: string;
    record: ChallengeRecord;
    challengeId?: string;
}
interface StoredRequest {
    challengeId: string;
    fingerprint: string;
}
export class AdmissionError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
    }
}
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
function fingerprint(input: EventStartRequest): string {
    // Stable request intent, including creator presentation and frozen questions.
    return JSON.stringify([
        input.challengeId ?? null,
        input.record.lang,
        input.record.game,
        input.record.questions.map((q) => [q.id, q.alternates ?? []]),
        input.record.createdBy.uuid,
        input.record.createdBy.nickname,
        input.record.mascot.fur,
        input.record.mascot.suit,
        input.record.mascot.accent,
        input.record.mascot.mic,
        input.record.event?.editionId,
        input.record.event?.contentRevision,
        input.record.event?.mode,
        input.record.event?.endsAt,
    ]);
}
export function parseEventStart(value: unknown): EventStartRequest | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Record<string, unknown>;
    if (!validId(v.requestId) || !validId(v.uuid) || !isChallengeRecord(v.record) || !v.record.event) return null;
    if (v.challengeId !== undefined && !validId(v.challengeId)) return null;
    return { requestId: v.requestId, uuid: v.uuid, record: v.record, challengeId: v.challengeId as string | undefined };
}
export async function admitEvent(
    db: D1Database,
    input: EventStartRequest,
    now = Date.now(),
    includeTestFixture = false,
): Promise<{ id: string }> {
    const { uuid, requestId, record } = input;
    const event = record.event!;
    const intent = fingerprint(input);
    const lookup = () =>
        db
            .prepare('SELECT challengeId, fingerprint FROM event_start_requests WHERE uuid = ? AND requestId = ?')
            .bind(uuid, requestId)
            .first<StoredRequest>();
    const prior = await lookup();
    if (prior) {
        if (prior.fingerprint !== intent) throw new AdmissionError(409, 'Start request changed');
        return { id: prior.challengeId };
    }
    const edition = findEdition(event.editionId, includeTestFixture);
    if (
        !edition ||
        eventLifecycle(edition, now) !== 'active' ||
        edition.endsAt !== event.endsAt ||
        validateEdition(
            edition,
            (a) => a.game === 'the-ladder' && eventContent[a.contentRevision]?.length === 15,
            (id) => !!id,
        ).length > 0
    )
        throw new AdmissionError(410, 'Event closed or unavailable');
    if (
        !edition.activities.some((a) => a.game === record.game && a.contentRevision === event.contentRevision) ||
        !validEventQuestions(record) ||
        record.expiresAt !== event.endsAt + EVENT_UPLOAD_WINDOW_MS
    )
        throw new AdmissionError(400, 'Unsupported event activity');
    if (!input.challengeId && record.createdBy.uuid !== uuid) throw new AdmissionError(400, 'Invalid creator');
    if (input.challengeId && event.mode !== 'friend')
        throw new AdmissionError(400, 'Random rounds cannot be joined by link');

    const newId = crypto.randomUUID();
    // All three writes are ONE D1 batch transaction. Candidate selection happens
    // inside the write, not in a prior network read; concurrent entrants serialize.
    const compatible = `c.eventEditionId = ? AND c.game = ? AND c.contentRevision = ? AND c.entryMode = ? AND c.expiresAt > ?`;
    const available = `(SELECT COUNT(*) FROM event_seats s WHERE s.challengeId = c.id) < 2`;
    const member = `EXISTS (SELECT 1 FROM event_seats s WHERE s.challengeId = c.id AND s.uuid = ?)`;
    const candidate = input.challengeId
        ? `SELECT c.id FROM challenges c WHERE c.id = ? AND ${compatible} AND (${available} OR ${member})`
        : event.mode === 'friend'
          ? 'SELECT ? AS id'
          : `SELECT COALESCE((SELECT c.id FROM challenges c WHERE ${compatible} AND ${available} AND NOT ${member} ORDER BY c.createdAt, c.id LIMIT 1), ?) AS id`;
    const candidateBindings = input.challengeId
        ? [input.challengeId, event.editionId, record.game, event.contentRevision, event.mode, now, uuid]
        : event.mode === 'friend'
          ? [newId]
          : [event.editionId, record.game, event.contentRevision, event.mode, now, uuid, newId];
    await db.batch([
        db
            .prepare(
                `INSERT INTO event_start_requests (uuid, requestId, challengeId, fingerprint, expiresAt)
            SELECT ?, ?, candidate.id, ?, ? FROM (${candidate}) candidate
            WHERE 1 ON CONFLICT(uuid, requestId) DO NOTHING`,
            )
            .bind(uuid, requestId, intent, record.expiresAt, ...candidateBindings),
        db
            .prepare(
                `INSERT INTO challenges (id, lang, game, questions, createdBy, expiresAt, mascot, event, eventEditionId, contentRevision, entryMode, createdAt)
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM event_start_requests WHERE uuid = ? AND requestId = ? AND challengeId = ?)
            ON CONFLICT(id) DO NOTHING`,
            )
            .bind(
                newId,
                record.lang,
                record.game,
                JSON.stringify(record.questions),
                JSON.stringify(record.createdBy),
                record.expiresAt,
                JSON.stringify(record.mascot),
                JSON.stringify(event),
                event.editionId,
                event.contentRevision,
                event.mode,
                now,
                uuid,
                requestId,
                newId,
            ),
        db
            .prepare(
                `INSERT INTO event_seats (challengeId, seat, uuid)
            SELECT r.challengeId, (SELECT COUNT(*) + 1 FROM event_seats s WHERE s.challengeId = r.challengeId), ?
            FROM event_start_requests r WHERE r.uuid = ? AND r.requestId = ?
            AND NOT EXISTS (SELECT 1 FROM event_seats s WHERE s.challengeId = r.challengeId AND s.uuid = ?)`,
            )
            .bind(uuid, uuid, requestId, uuid),
    ]);
    const admitted = await lookup();
    if (!admitted) throw new AdmissionError(409, 'Event round is full');
    if (admitted.fingerprint !== intent) throw new AdmissionError(409, 'Start request changed');
    return { id: admitted.challengeId };
}
