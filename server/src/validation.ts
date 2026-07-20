// Server-side payload validation. Ports the guarantees `firestore.rules` enforced
// before the D1 migration (ADR-0003 / ADR-0004) so the new backend is behaviour-
// identical — App Check proves a request came from a genuine app, NOT that the
// payload is honest, so these checks still matter. Keep in sync with the rules.

import { isChallengeRecord, isValidChallengeId, type ChallengeRecord } from '../../shared/challenge/contract';

export const SIGNATURE_SLUGS = ['sprout', 'spark', 'fire', 'gem', 'star', 'crown'];
export const RANKED_GAMES = ['the-ladder', 'the-drop', 'the-wheel'];
export const MAX_SCORE = 1_000_000_000;
export const MAX_SYNC_IDS = 100;

export interface BoundedSyncIds {
    uuid: string;
    ids: string[];
}

type Json = Record<string, unknown>;

const isString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const hasOnly = (o: Json, keys: string[]): boolean => Object.keys(o).every((k) => keys.includes(k));
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null;

/** A challenge document id — non-empty, bounded. */
export function isValidId(v: unknown): v is string {
    return isValidChallengeId(v);
}

/** Parse the shared security boundary for bounded pull-sync requests. */
export function parseBoundedSyncIds(
    body: Json | null,
    field: 'sourceChallengeIds' | 'challengeIds',
): BoundedSyncIds | null {
    if (!body || !isValidId(body.uuid)) return null;
    const ids = body[field];
    if (!Array.isArray(ids) || ids.length > MAX_SYNC_IDS || !ids.every(isValidId)) return null;
    return { uuid: body.uuid, ids };
}

export function validateChallenge(d: unknown): d is ChallengeRecord {
    return isChallengeRecord(d, { nowMs: Date.now() });
}

export function validateAttempt(d: unknown): boolean {
    if (!isObject(d)) return false;
    if (!hasOnly(d, ['nickname', 'progress', 'score', 'timestamp'])) return false;
    if (!isString(d.nickname, 24)) return false;
    if (!Number.isInteger(d.progress)) return false;
    if (typeof d.score !== 'number') return false;
    if (!Number.isInteger(d.timestamp)) return false;
    return true;
}

export function validateRankingEntry(d: unknown): boolean {
    if (!isObject(d)) return false;
    if (!hasOnly(d, ['nickname', 'score', 'signature'])) return false;
    if (typeof d.nickname !== 'string' || d.nickname.length < 1 || d.nickname.length > 24) return false;
    if (typeof d.score !== 'number' || d.score < 0 || d.score > MAX_SCORE) return false;
    if ('signature' in d && d.signature !== undefined && d.signature !== null) {
        if (typeof d.signature !== 'string' || !SIGNATURE_SLUGS.includes(d.signature)) return false;
    }
    return true;
}

export function isRankedGame(game: string): boolean {
    return RANKED_GAMES.includes(game);
}

/**
 * The server clock decides the month: a `YYYY-MM` period must equal the current
 * UTC month, so a tampered device clock can't write into another month. 'alltime'
 * is always writable (it never resets).
 */
export function isWritablePeriod(period: string): boolean {
    if (period === 'alltime') return true;
    if (period.length !== 7) return false;
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = `${now.getUTCMonth() + 1}`.padStart(2, '0');
    return period === `${yyyy}-${mm}`;
}
