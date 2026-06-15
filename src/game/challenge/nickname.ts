import { createMMKV } from 'react-native-mmkv';
import { containsProfanity } from '../../utils/nickname';

// The PUBLIC nickname attached to async-challenge attempts and the global
// ranking (ADR-0003/0004). Kept separate from the local leaderboard nickname
// (`leaderboard.ts` lastNickname) so only this one passes the profanity gate —
// the local one stays private and unfiltered. Same MMKV store, distinct key.

const store = createMMKV({ id: 'showdown' });
const KEY = 'challengeNickname';

/** The nickname this device uses for challenges / the global ranking (empty if unset). */
export function getChallengeNickname(): string {
    return store.getString(KEY) ?? '';
}

/**
 * Persist this device's public nickname, gating profanity at the one place it's
 * stored so no caller can write an unfiltered value. Returns false (and stores
 * nothing) when the nickname is rejected, so callers can surface an error.
 */
export function setChallengeNickname(nickname: string): boolean {
    if (containsProfanity(nickname)) return false;
    store.set(KEY, nickname);
    return true;
}
