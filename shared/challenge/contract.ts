export const CHALLENGE_TTL_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_CHALLENGE_LIFETIME_DAYS = 31;

export type ChallengeLocale = 'en' | 'pl';
export type ChallengeGameId = 'the-ladder' | 'the-drop' | 'the-wheel';
export type MascotSlot = 'fur' | 'suit' | 'accent' | 'mic';
export type ChallengeMascotLook = Record<MascotSlot, string>;

export interface ChallengeQuestion {
    id: string;
    alternates?: string[];
}

export interface ChallengeCreator {
    uuid: string;
    nickname: string;
}

export interface ChallengeRecord {
    lang: ChallengeLocale;
    game: string;
    questions: ChallengeQuestion[];
    createdBy: ChallengeCreator;
    expiresAt: number;
    mascot: ChallengeMascotLook;
}

export interface ChallengeRecordValidationOptions {
    nowMs?: number;
}

const CHALLENGE_GAMES: readonly ChallengeGameId[] = ['the-ladder', 'the-drop', 'the-wheel'];
const MASCOT_SLOTS: readonly MascotSlot[] = ['fur', 'suit', 'accent', 'mic'];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnly(value: JsonObject, keys: readonly string[]): boolean {
    return Object.keys(value).every((key) => keys.includes(key));
}

function isString(value: unknown, maxLength: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

export function isValidChallengeId(value: unknown): value is string {
    return isString(value, 64);
}

function isChallengeLocale(value: unknown): value is ChallengeLocale {
    return value === 'en' || value === 'pl';
}

function isChallengeGameId(value: unknown): value is ChallengeGameId {
    return CHALLENGE_GAMES.includes(value as ChallengeGameId);
}

function isChallengeQuestion(value: unknown): value is ChallengeQuestion {
    if (!isObject(value)) return false;
    if (!hasOnly(value, ['id', 'alternates'])) return false;
    if (!isValidChallengeId(value.id)) return false;
    if ('alternates' in value) {
        if (!Array.isArray(value.alternates) || value.alternates.length > 5) return false;
        if (!value.alternates.every(isValidChallengeId)) return false;
    }
    return true;
}

function isChallengeCreator(value: unknown): value is ChallengeCreator {
    if (!isObject(value)) return false;
    if (!hasOnly(value, ['uuid', 'nickname'])) return false;
    return isString(value.uuid, 64) && isString(value.nickname, 24);
}

function isChallengeMascotLook(value: unknown): value is ChallengeMascotLook {
    if (!isObject(value)) return false;
    if (!hasOnly(value, MASCOT_SLOTS)) return false;
    return MASCOT_SLOTS.every((slot) => typeof value[slot] === 'string' && value[slot].length > 0);
}

export function isChallengeRecord(
    value: unknown,
    options: ChallengeRecordValidationOptions = {},
): value is ChallengeRecord {
    if (!isObject(value)) return false;
    if (!hasOnly(value, ['lang', 'game', 'questions', 'createdBy', 'expiresAt', 'mascot'])) return false;
    if (!isChallengeLocale(value.lang)) return false;
    if (!isChallengeGameId(value.game)) return false;
    if (!Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 50) return false;
    if (!value.questions.every(isChallengeQuestion)) return false;
    if (!isChallengeCreator(value.createdBy)) return false;
    const expiresAt = value.expiresAt;
    if (typeof expiresAt !== 'number' || !Number.isInteger(expiresAt)) return false;
    if (!isChallengeMascotLook(value.mascot)) return false;

    if (options.nowMs !== undefined) {
        if (expiresAt >= options.nowMs + MAX_CHALLENGE_LIFETIME_DAYS * MS_PER_DAY) return false;
    }

    return true;
}

export function parseChallengeRecord(
    value: unknown,
    options: ChallengeRecordValidationOptions = {},
): ChallengeRecord | null {
    return isChallengeRecord(value, options) ? value : null;
}

export function serializeChallengeRecord(record: ChallengeRecord): ChallengeRecord {
    if (!isChallengeRecord(record)) {
        throw new Error('Invalid Challenge Record');
    }
    return record;
}
