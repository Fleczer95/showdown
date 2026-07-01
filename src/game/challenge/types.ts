// Wire + on-device types for the Async Challenge (ADR-0003). A challenge is one
// Firestore document holding a frozen round; each participant's result is a
// `c/{id}/attempts/{uuid}` doc. The record pins only the question *ids* — every
// pack's content ships bundled on every device (owned or not), so each opponent
// resolves those ids against its own on-device content, in its own language, and
// shuffles the options locally. An id this app doesn't have yet (a pack added in
// a newer app version) is the signal to prompt an update — see `resolve.ts`.

import type { LeaderboardEntry } from '../leaderboard';

/** A challenge link is valid for this long after creation; Firestore TTL prunes it. */
export const CHALLENGE_TTL_DAYS = 30;

/** Supported authoring/play locales. */
export type ChallengeLocale = 'en' | 'pl';

/**
 * One frozen question, referenced by stable `id` and resolved against on-device
 * content at play time. `alternates` pins The Ladder's Skip-lifeline targets for
 * the rung; other games omit it.
 */
export interface ChallengeQuestion {
    id: string;
    alternates?: string[];
}

/** Who created the challenge — attribution only, never used for auth. */
export interface ChallengeCreator {
    uuid: string;
    nickname: string;
}

/**
 * The challenge document at `c/{id}`. Immutable after create (enforced by
 * security rules).
 */
export interface ChallengeRecord {
    /** Authoring language — the fallback when a player's locale isn't 'en'/'pl'. */
    lang: ChallengeLocale;
    /** Game id, e.g. `the-ladder` / `the-drop` / `the-wheel`. */
    game: string;
    /** Ordered, frozen run — question ids resolved on-device at play time. */
    questions: ChallengeQuestion[];
    createdBy: ChallengeCreator;
    /** Epoch ms; Firestore TTL deletes the doc at this time. */
    expiresAt: number;
    /**
     * The creator's equipped mascot look (plan §7.4): a thin `{ slot: colorId }`
     * map of identifiers only — the opponent's device re-renders it locally, so
     * it shows even colors that device doesn't own (unknown colorIds fall back to
     * slot defaults).
     */
    mascot: Record<string, string>;
}

/**
 * One participant's result at `c/{id}/attempts/{uuid}`. A `LeaderboardEntry`
 * (so the reveal can reuse `rankEntries`) — `nickname`, `progress`, `score`,
 * `timestamp`. Create-only, one per device UUID.
 */
export type Attempt = LeaderboardEntry;
