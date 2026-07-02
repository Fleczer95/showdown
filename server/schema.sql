-- Showdown D1 schema. Mirrors the Firestore data model (ADR-0003 / ADR-0004).
-- Apply with: npm run schema:remote  (or schema:local for `wrangler dev`).

-- A frozen challenge round. Immutable after create (enforced in the Worker).
CREATE TABLE IF NOT EXISTS challenges (
    id        TEXT PRIMARY KEY,
    lang      TEXT NOT NULL,
    game      TEXT NOT NULL,
    questions TEXT NOT NULL,   -- JSON-stringified ChallengeQuestion[]
    createdBy TEXT NOT NULL,   -- JSON-stringified { uuid, nickname }
    expiresAt INTEGER NOT NULL, -- epoch ms
    mascot    TEXT NOT NULL    -- JSON-stringified { fur, suit, accent, mic }
);
CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges(expiresAt);

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
