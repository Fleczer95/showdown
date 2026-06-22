import { request } from '../challenge/store';
import { DISPLAY_SIZE } from './config';
import type { RankingEntry } from './types';

// The only network touchpoint for the global ranking (ADR-0004). Talks to the
// Showdown Worker API (Cloudflare + D1) over HTTPS, reusing the challenge store's
// App Check `request` helper (timeout + typed-error mapping). A board is
// `rankings/{game}/{period}/entries/{uuid}`, where `period` is a UTC `YYYY-MM`
// month or the literal `alltime`. Reads gate the board UI, so each call is
// timeout-wrapped for a connect+retry screen.

/** The top `DISPLAY_SIZE` entries of a board, ranked by score descending. */
export function getBoard(game: string, period: string): Promise<RankingEntry[]> {
    return request<RankingEntry[]>(`/rankings/${game}/${period}?limit=${DISPLAY_SIZE}`);
}

/** How many entries a bucket holds — drives the delayed-switch threshold. */
export async function countEntries(game: string, period: string): Promise<number> {
    return (await request<{ count: number }>(`/rankings/${game}/${period}/count`)).count;
}

/** The lowest stored score in a bucket (null when empty) — the qualify cutoff. */
export async function lowestScore(game: string, period: string): Promise<number | null> {
    return (await request<{ score: number | null }>(`/rankings/${game}/${period}/lowest`)).score;
}

/** Write this device's entry. Create + best-only update are enforced server-side. */
export async function submitEntry(game: string, period: string, uuid: string, entry: RankingEntry): Promise<void> {
    await request(`/rankings/${game}/${period}/entries/${uuid}`, { method: 'POST', body: JSON.stringify(entry) });
}
