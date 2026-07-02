-- Apply to existing internal D1 databases created before Challenge Record
-- required the creator's mascot look.
ALTER TABLE challenges ADD COLUMN mascot TEXT NOT NULL DEFAULT '{"fur":"fur.orange","suit":"suit.royal","accent":"accent.crimson","mic":"mic.gold"}';
