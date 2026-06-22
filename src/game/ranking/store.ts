import { withTimeout, fetchWithAppCheck, httpError } from '../challenge/store';
import { DISPLAY_SIZE } from './config';
import type { RankingEntry } from './types';

// The only network touchpoint for the global ranking (ADR-0004). Talks to the
// Showdown Worker API (Cloudflare + D1) over HTTPS, reusing the challenge store's
// App Check fetch + typed-error mapping. A board is
// `rankings/{game}/{period}/entries/{uuid}`, where `period` is a UTC `YYYY-MM`
// month or the literal `alltime`. Reads gate the board UI, so each call is
// timeout-wrapped for a connect+retry screen.

/** The top `DISPLAY_SIZE` entries of a board, ranked by score descending. */
export async function getBoard(game: string, period: string): Promise<RankingEntry[]> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/rankings/${game}/${period}?limit=${DISPLAY_SIZE}`);
            if (!res.ok) throw httpError(res.status);
            return (await res.json()) as RankingEntry[];
        })(),
    );
}

/** How many entries a bucket holds — drives the delayed-switch threshold. */
export async function countEntries(game: string, period: string): Promise<number> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/rankings/${game}/${period}/count`);
            if (!res.ok) throw httpError(res.status);
            return ((await res.json()) as { count: number }).count;
        })(),
    );
}

/** The lowest stored score in a bucket (null when empty) — the qualify cutoff. */
export async function lowestScore(game: string, period: string): Promise<number | null> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/rankings/${game}/${period}/lowest`);
            if (!res.ok) throw httpError(res.status);
            return ((await res.json()) as { score: number | null }).score;
        })(),
    );
}

/** Write this device's entry. Create + best-only update are enforced server-side. */
export async function submitEntry(game: string, period: string, uuid: string, entry: RankingEntry): Promise<void> {
    return withTimeout(
        (async () => {
            const res = await fetchWithAppCheck(`/rankings/${game}/${period}/entries/${uuid}`, {
                method: 'POST',
                body: JSON.stringify(entry),
            });
            if (!res.ok) throw httpError(res.status);
        })(),
    );
}
