import { deviceStore } from '../../storage/appStores';

/** Last APP_VERSION the player was caught up on. Absent means "never launched". */
export const WHATS_NEW_SEEN_KEY = 'whatsNewSeenVersion';

/** Last store version we nudged about. Holds an iOS semver or an Android versionCode. */
export const UPDATE_PROMPT_SEEN_KEY = 'updatePromptSeenVersion';

/**
 * `seed` — fresh install: record the version, show nothing. A brand-new player
 * has nothing to catch up on.
 * `show` — updated, and this build ships notes.
 * `bump` — updated, but this build has no notes entry (a silent patch). Advance
 * the key anyway so a later real release is not suppressed.
 * `none` — already caught up on this build.
 */
export type WhatsNewDecision = 'seed' | 'show' | 'bump' | 'none';

/**
 * An absent key means one of two very different things: a genuinely fresh
 * install, or an existing player upgrading into the first build that ships this
 * feature — the key cannot exist in any earlier release. Treating both as fresh
 * would silently suppress the notes for every existing player on the debut
 * release, which is precisely the audience the sheet is for.
 *
 * `hasPriorUse` breaks the tie: it is true when the install carries progression
 * from before, which a first launch cannot. An upgrading player who never
 * played is still counted as fresh — they have nothing to be caught up on
 * either, so the outcome is right for the wrong reason and harmless.
 */
export function decideWhatsNew(
    seenVersion: string | undefined,
    appVersion: string,
    /** The version the bundled notes describe, or null when this build ships none. */
    notesVersion: string | null,
    hasPriorUse: boolean = false,
): WhatsNewDecision {
    if (seenVersion === undefined && !hasPriorUse) return 'seed';
    if (seenVersion === appVersion) return 'none';
    // No notes for this build — nothing to show, but still record the version
    // so the next release with notes is not mistaken for an old one.
    return notesVersion !== null && notesVersion === appVersion ? 'show' : 'bump';
}

/**
 * Equality only — never ordering. iOS reports a semver string and Android a
 * versionCode number, so there is no comparison that is correct on both.
 */
export function shouldPromptUpdate(seenVersion: string | undefined, storeVersion: string): boolean {
    return seenVersion !== storeVersion;
}

export function readWhatsNewSeen(): string | undefined {
    return deviceStore.getString(WHATS_NEW_SEEN_KEY);
}

export function markWhatsNewSeen(version: string): void {
    deviceStore.set(WHATS_NEW_SEEN_KEY, version);
}

export function readUpdatePromptSeen(): string | undefined {
    return deviceStore.getString(UPDATE_PROMPT_SEEN_KEY);
}

export function markUpdatePromptSeen(storeVersion: string): void {
    deviceStore.set(UPDATE_PROMPT_SEEN_KEY, storeVersion);
}
