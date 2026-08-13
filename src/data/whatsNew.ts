/**
 * The current version's highlights, shown once after the player updates.
 *
 * Only ONE entry exists at a time — there is deliberately no changelog history
 * to maintain.
 *
 * Nothing here is load-bearing: the sheet appears only when `version` matches
 * `APP_VERSION` (app.json) AND `highlights` is non-empty. Any other state — a
 * stale version, an emptied list, a release nobody wrote notes for — simply
 * means no sheet. It is never an error, and the seen-version key is advanced
 * either way so a later release is not suppressed.
 *
 * Leaving `highlights` empty is therefore the supported way to ship a release
 * with no what's-new sheet at all.
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

// Android ships cloud save as 1.4.1; iOS 1.4.1 was the Game Center fix and is
// already live, so its players saw no sheet and their seen-version key has moved
// past it. Only Android updating from 1.4.0 gets these highlights.
export const WHATS_NEW: WhatsNewEntry = {
    version: '1.4.1',
    highlights: [
        { emoji: '☁️', key: 'whatsNew.1_4_1.cloudSave' },
        { emoji: '🦊', key: 'whatsNew.1_4_1.notice' },
        { emoji: '🛡️', key: 'whatsNew.1_4_1.safety' },
    ],
};
