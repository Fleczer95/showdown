// Server-side payload validation. Ports the guarantees `firestore.rules` enforced
// before the D1 migration (ADR-0003 / ADR-0004) so the new backend is behaviour-
// identical — App Check proves a request came from a genuine app, NOT that the
// payload is honest, so these checks still matter. Keep in sync with the rules.

import { isChallengeRecord, isValidChallengeId } from '../../shared/challenge/contract';

export const SIGNATURE_SLUGS = ['sprout', 'spark', 'fire', 'gem', 'star', 'crown'];
export const RANKED_GAMES = ['the-ladder', 'the-drop', 'the-wheel'];
export const MAX_SCORE = 1_000_000_000;

type Json = Record<string, unknown>;

const isString = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const hasOnly = (o: Json, keys: string[]): boolean => Object.keys(o).every((k) => keys.includes(k));
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null;

/** A challenge document id — non-empty, bounded. */
export function isValidId(v: unknown): v is string {
    return isValidChallengeId(v);
}

export function validateChallenge(d: unknown): boolean {
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
