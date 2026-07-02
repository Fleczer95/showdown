// Client-facing re-exports for the shared Async Challenge contract. The canonical
// wire shape lives in `shared/challenge/contract.ts` so the app and Worker cross
// the same interface.

import type { LeaderboardEntry } from '../leaderboard';

export {
    CHALLENGE_TTL_DAYS,
    parseChallengeRecord,
    serializeChallengeRecord,
    type ChallengeCreator,
    type ChallengeGameId,
    type ChallengeLocale,
    type ChallengeMascotLook,
    type ChallengeQuestion,
    type ChallengeRecord,
} from '../../../shared/challenge/contract';

/**
 * One participant's result at `c/{id}/attempts/{uuid}`. A `LeaderboardEntry`
 * (so the reveal can reuse `rankEntries`) — `nickname`, `progress`, `score`,
 * `timestamp`. Create-only, one per device UUID.
 */
export type Attempt = LeaderboardEntry;
