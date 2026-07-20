-- Directed 1:1 follow-up rounds. Metadata stays server-side so the canonical
-- immutable Challenge Record wire contract remains unchanged.
ALTER TABLE challenges ADD COLUMN rematchOf TEXT;
ALTER TABLE challenges ADD COLUMN recipientUuid TEXT;

CREATE INDEX IF NOT EXISTS idx_challenges_recipient
ON challenges(recipientUuid, expiresAt);

-- A completed round can have only one immediate successor. This also makes
-- retries and simultaneous requests from both players converge on one rematch.
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenges_one_rematch
ON challenges(rematchOf) WHERE rematchOf IS NOT NULL;
