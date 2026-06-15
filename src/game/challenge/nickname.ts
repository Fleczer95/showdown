import { createMMKV } from 'react-native-mmkv';

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

export function setChallengeNickname(nickname: string): void {
    store.set(KEY, nickname);
}
