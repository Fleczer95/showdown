import { profileStore } from '../../storage/appStores';
import { containsProfanity, stripNonText } from '../../utils/nickname';

// The PUBLIC nickname attached to async-challenge attempts and the global
// ranking (ADR-0003/0004). Kept separate from the local leaderboard nickname
// (`leaderboard.ts` lastNickname) so only this one passes the profanity gate —
// the local one stays private and unfiltered.

const KEY = 'challengeNickname';

/** The nickname this device uses for challenges / the global ranking (empty if unset). */
export function getChallengeNickname(): string {
    return profileStore.getString(KEY) ?? '';
}

/**
 * Persist this device's public nickname, sanitizing at the one place it's stored so
 * no caller can write an unfiltered value: strip to text-only (no emoji, so the only
 * glyph on a board row is the system signature), then gate profanity. Returns false
 * (and stores nothing) when the result is empty or rejected, so callers can surface
 * an error.
 */
export function setChallengeNickname(nickname: string): boolean {
    const cleaned = stripNonText(nickname);
    if (cleaned.length === 0 || containsProfanity(cleaned)) return false;
    profileStore.set(KEY, cleaned);
    return true;
}
