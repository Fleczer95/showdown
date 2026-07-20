export interface AttemptPayload {
    nickname: string;
    progress: number;
    score: number;
    timestamp: number;
}

/**
 * Legacy and group challenges remain open to any App-Checked installation.
 * Directed rematches have exactly two structural seats: their creator and the
 * server-derived recipient. This limits accidental third-party participation;
 * UUIDs are still routing identifiers, not authentication credentials.
 */
export function canSubmitDirectedAttempt(createdByJson: string, recipientUuid: string | null, uuid: string): boolean {
    if (recipientUuid === null) return true;
    try {
        const creator = JSON.parse(createdByJson) as { uuid?: unknown };
        return creator.uuid === uuid || recipientUuid === uuid;
    } catch {
        return false;
    }
}

/** A retry after an uncertain timeout succeeds only when the committed attempt
 * is byte-for-byte equivalent at the domain-field level. Different results
 * remain a conflict and can never overwrite the first submission. */
export function isSameAttempt(existing: AttemptPayload, incoming: AttemptPayload): boolean {
    return (
        existing.nickname === incoming.nickname &&
        existing.progress === incoming.progress &&
        existing.score === incoming.score &&
        existing.timestamp === incoming.timestamp
    );
}
