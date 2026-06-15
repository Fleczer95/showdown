import firestore from '@react-native-firebase/firestore';
import { OfflineError } from '../challenge/store';
import { DISPLAY_SIZE } from './config';
import type { RankingEntry } from './types';

// The only Firestore touchpoint for the global ranking (ADR-0004). A board is
// `rankings/{game}/periods/{period}/entries/{uuid}`, where `period` is a UTC
// `YYYY-MM` month or the literal `alltime`. The app reads/writes directly — no
// server. Reads gate the board UI, so each call is timeout-wrapped and surfaces
// the same `OfflineError` the challenge flow uses for a connect+retry screen.

const RANKINGS = 'rankings';
const PERIODS = 'periods';
const ENTRIES = 'entries';

const REQUEST_TIMEOUT_MS = 10_000;

/** Reject with `OfflineError` if `promise` doesn't settle within the timeout. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new OfflineError()), REQUEST_TIMEOUT_MS);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err instanceof OfflineError ? err : new OfflineError(err));
            },
        );
    });
}

function entriesRef(game: string, period: string) {
    return firestore().collection(RANKINGS).doc(game).collection(PERIODS).doc(period).collection(ENTRIES);
}

/** The top `DISPLAY_SIZE` entries of a board, ranked by score descending. */
export async function getBoard(game: string, period: string): Promise<RankingEntry[]> {
    const snapshot = await withTimeout(entriesRef(game, period).orderBy('score', 'desc').limit(DISPLAY_SIZE).get());
    return snapshot.docs.map((doc) => doc.data() as RankingEntry);
}

/** How many entries a bucket holds — drives the delayed-switch threshold. One
 * aggregation read, not a full fetch. */
export async function countEntries(game: string, period: string): Promise<number> {
    const snapshot = await withTimeout(entriesRef(game, period).count().get());
    return snapshot.data().count;
}

/** The lowest stored score in a bucket (null when empty) — the qualify cutoff. */
export async function lowestScore(game: string, period: string): Promise<number | null> {
    const snapshot = await withTimeout(entriesRef(game, period).orderBy('score', 'asc').limit(1).get());
    return snapshot.empty ? null : (snapshot.docs[0].data() as RankingEntry).score;
}

/** Write this device's entry. Create + best-only update are enforced by rules. */
export async function submitEntry(game: string, period: string, uuid: string, entry: RankingEntry): Promise<void> {
    await withTimeout(entriesRef(game, period).doc(uuid).set(entry));
}
