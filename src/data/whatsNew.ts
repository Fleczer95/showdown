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

export const WHATS_NEW: WhatsNewEntry = {
    version: '1.4.0',
    highlights: [
        { emoji: '🏆', key: 'whatsNew.1_4_0.gameCenter' },
        { emoji: '🐛', key: 'whatsNew.1_4_0.fixes' },
    ],
};
