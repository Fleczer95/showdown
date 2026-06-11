import { createMMKV } from 'react-native-mmkv';
import { seedDeck, type History } from './deck';

// The only persistence touchpoint for question history. Keyed by game id
// (e.g. 'the-ladder', 'the-drop', 'the-wheel'); each value is a JSON
// `Record<questionId, showCount>`. Pure selection lives in `deck.ts`.

const storage = createMMKV({ id: 'showdown-history' });

/** Read a game's show-count history (empty when nothing has been played). */
export function getHistory(gameId: string): History {
    const json = storage.getString(gameId);
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        return parsed && typeof parsed === 'object' ? (parsed as History) : {};
    } catch {
        return {};
    }
}

/** Increment a question's show-count. Call when the question is displayed. */
export function markShown(gameId: string, id: string): void {
    const history = getHistory(gameId);
    history[id] = (history[id] ?? 0) + 1;
    storage.set(gameId, JSON.stringify(history));
}

/**
 * Seed `ids` not yet in a game's history to the current pool floor (see
 * `seedDeck`). Call when an IAP pack unlocks so its questions blend into
 * rotation. Writes only when at least one id is new, so it is a cheap no-op on
 * already-seeded packs (e.g. on restore or app restart).
 */
export function seedHistory(gameId: string, ids: string[]): void {
    const history = getHistory(gameId);
    const seeded = seedDeck(history, ids);
    if (Object.keys(seeded).length !== Object.keys(history).length) {
        storage.set(gameId, JSON.stringify(seeded));
    }
}
