// Wire + on-device types for the Async Challenge (ADR-0003). A challenge is one
// Firestore document holding a frozen round; each participant's result is a
// `c/{id}/attempts/{uuid}` doc. The record embeds every question's payload in
// all locales so any opponent can play regardless of which premium packs they
// own, and in their own device language.

import type { LeaderboardEntry } from '../leaderboard';

/** Bump when the record shape changes incompatibly. Stored on every record. */
export const SCHEMA_VERSION = 1;

/**
 * Oldest app version that can safely open a `SCHEMA_VERSION` record. An app
 * older than this shows "Update to take this challenge" instead of crashing.
 * Bump together with `SCHEMA_VERSION` when a change needs a newer app.
 */
export const MIN_APP_VERSION = '0.9.0';

/** A challenge link is valid for this long after creation; Firestore TTL prunes it. */
export const CHALLENGE_TTL_DAYS = 30;

/** Supported authoring/play locales. The record embeds a payload per locale. */
export type ChallengeLocale = 'en' | 'pl';

/**
 * One frozen question: a stable `id` plus its fully-resolved payload in every
 * locale. `byLocale` carries whatever runtime shape the owning game plays
 * (Ladder question, Drop question, Wheel puzzle), so the player's device can
 * render it without owning the source pack.
 */
export interface ChallengeQuestion<TPayload = unknown> {
    id: string;
    byLocale: Record<ChallengeLocale, TPayload>;
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
    schemaVersion: number;
    minAppVersion: string;
    /** App version that authored the record (diagnostics only). */
    appVersion: string;
    /** Authoring language — the fallback when a player's locale isn't embedded. */
    lang: ChallengeLocale;
    /** Game id, e.g. `the-ladder` / `the-drop` / `the-wheel`. */
    game: string;
    /** Ordered, frozen run. */
    questions: ChallengeQuestion[];
    createdBy: ChallengeCreator;
    /** Epoch ms; Firestore TTL deletes the doc at this time. */
    expiresAt: number;
}

/**
 * One participant's result at `c/{id}/attempts/{uuid}`. A `LeaderboardEntry`
 * (so the reveal can reuse `rankEntries`) — `nickname`, `progress`, `score`,
 * `timestamp`. Create-only, one per device UUID.
 */
export type Attempt = LeaderboardEntry;
