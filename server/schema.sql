-- Showdown D1 schema. Mirrors the Firestore data model (ADR-0003 / ADR-0004).
-- Apply with: npm run schema:remote  (or schema:local for `wrangler dev`).

-- A frozen challenge round. Immutable after create (enforced in the Worker).
CREATE TABLE IF NOT EXISTS challenges (
    id        TEXT PRIMARY KEY,
    lang      TEXT NOT NULL,
    game      TEXT NOT NULL,
    questions TEXT NOT NULL,   -- JSON-stringified ChallengeQuestion[]
    createdBy TEXT NOT NULL,   -- JSON-stringified { uuid, nickname }
    expiresAt     INTEGER NOT NULL, -- epoch ms
    mascot       TEXT NOT NULL DEFAULT '{"fur":"fur.orange","suit":"suit.royal","accent":"accent.crimson","mic":"mic.gold"}', -- JSON-stringified { fur, suit, accent, mic }
    rematchOf     TEXT, -- source challenge id for a directed 1:1 follow-up
    recipientUuid TEXT, -- server-derived recipient; never accepted directly from the client
    event TEXT,
    eventEditionId TEXT,
    contentRevision TEXT,
    entryMode TEXT,
    createdAt INTEGER
);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges(expiresAt);
CREATE INDEX IF NOT EXISTS idx_challenges_recipient ON challenges(recipientUuid, expiresAt);
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_rematch ON challenges(rematchOf) WHERE rematchOf IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_queue ON challenges(eventEditionId, game, contentRevision, entryMode, createdAt, id);
CREATE TABLE IF NOT EXISTS event_seats (
    challengeId TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    seat INTEGER NOT NULL CHECK (seat IN (1, 2)),
    uuid TEXT NOT NULL,
    PRIMARY KEY (challengeId, seat),
    UNIQUE (challengeId, uuid)
);
CREATE TABLE IF NOT EXISTS event_start_requests (
    uuid TEXT NOT NULL, requestId TEXT NOT NULL, challengeId TEXT NOT NULL,
    fingerprint TEXT NOT NULL, expiresAt INTEGER NOT NULL,
    PRIMARY KEY (uuid, requestId)
);

-- One participant result per device. Create-only, one row per (challenge, uuid).
-- The FK documents intent; the Worker also deletes attempts explicitly on cleanup
-- so we never rely on D1 having CASCADE enforcement enabled.
CREATE TABLE IF NOT EXISTS attempts (
    challengeId TEXT NOT NULL,
    uuid        TEXT NOT NULL,
    nickname    TEXT NOT NULL,
    progress    INTEGER NOT NULL,
    score       INTEGER NOT NULL,
    timestamp   INTEGER NOT NULL,
    PRIMARY KEY (challengeId, uuid),
    FOREIGN KEY (challengeId) REFERENCES challenges(id) ON DELETE CASCADE
);

-- Per-game, score-only bounded leaderboard. `signature` is an optional earned
-- cosmetic slug (validated against an allowlist in the Worker). No timestamp —
-- ties break by uuid to match the old Firestore document-id ordering.
CREATE TABLE IF NOT EXISTS rankings (
    game      TEXT NOT NULL,
    period    TEXT NOT NULL,   -- 'alltime' or UTC 'YYYY-MM'
    uuid      TEXT NOT NULL,
    nickname  TEXT NOT NULL,
    score     INTEGER NOT NULL,
    signature TEXT,            -- earned slug or NULL
    PRIMARY KEY (game, period, uuid)
);
CREATE INDEX IF NOT EXISTS idx_rankings_score ON rankings(game, period, score DESC);
