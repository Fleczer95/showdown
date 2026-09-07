-- Additive. Event expiresAt is the retention deadline, not the play deadline.
ALTER TABLE challenges ADD COLUMN event TEXT;
ALTER TABLE challenges ADD COLUMN eventEditionId TEXT;
ALTER TABLE challenges ADD COLUMN contentRevision TEXT;
ALTER TABLE challenges ADD COLUMN entryMode TEXT;
ALTER TABLE challenges ADD COLUMN createdAt INTEGER;
CREATE INDEX idx_event_queue ON challenges(eventEditionId, game, contentRevision, entryMode, createdAt, id);

CREATE TABLE event_seats (
    challengeId TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    seat INTEGER NOT NULL CHECK (seat IN (1, 2)),
    uuid TEXT NOT NULL,
    PRIMARY KEY (challengeId, seat),
    UNIQUE (challengeId, uuid)
);
-- Durable idempotency mapping is retained for the full event upload window.
CREATE TABLE event_start_requests (
    uuid TEXT NOT NULL,
    requestId TEXT NOT NULL,
    challengeId TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    PRIMARY KEY (uuid, requestId)
);
