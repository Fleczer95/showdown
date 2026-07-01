import { poolFor } from './lines';
import type { BucketId } from './buckets';

export function pickLine(
    bucketId: BucketId,
    opts: { recent: string[]; count?: number; rand?: () => number },
): string {
    const pool = poolFor(bucketId);
    const rand = opts.rand ?? Math.random;

    if (pool.escalation && typeof opts.count === 'number') {
        const { thresholds, keys } = pool.escalation;
        let idx = -1;
        for (let i = 0; i < thresholds.length; i++) {
            if (opts.count >= thresholds[i]) idx = i;
        }
        if (idx >= 0) return keys[idx];
        // below the first threshold: fall through to the base pool
    }

    const filtered = pool.keys.filter((k) => !opts.recent.includes(k));
    const choices = filtered.length > 0 ? filtered : pool.keys;
    return choices[Math.floor(rand() * choices.length)];
}
