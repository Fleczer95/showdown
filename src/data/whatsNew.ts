/**
 * The current version's highlights, shown once after the player updates.
 *
 * Only ONE entry exists at a time — there is deliberately no changelog history
 * to maintain. `version` must match `APP_VERSION` (app.json) for the sheet to
 * appear; when it does not, the sheet stays quiet and the seen-version key is
 * advanced silently (see services/appUpdate/seenVersions).
 *
 * Updated as part of the release ritual — see the `release-notes` skill.
 */
export interface WhatsNewHighlight {
    emoji: string;
    /** i18n key resolving to one short sentence. */
    key: string;
}

export interface WhatsNewEntry {
    version: string;
    highlights: WhatsNewHighlight[];
}

export const WHATS_NEW: WhatsNewEntry = {
    version: '1.4.0',
    highlights: [
        { emoji: '🏆', key: 'whatsNew.1_4_0.gameCenter' },
        { emoji: '🐛', key: 'whatsNew.1_4_0.fixes' },
    ],
};
