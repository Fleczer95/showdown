// The cloud restore runs once at launch, before the React tree exists; the sheet
// that reports it lives on Home and decides once per launch. This is the seam
// between them: a promise, not a value, because Home usually mounts while the
// cloud round-trip is still in flight and a plain variable would be read too early.
//
// Deliberately launch-scoped and not persisted. A restore outcome is only
// interesting on the launch it happened.

import type { RestoreOutcome } from './cloudSave';

let pending: Promise<RestoreOutcome> = Promise.resolve({ status: 'none' });

/** Record the launch's restore attempt. Called once, from the startup path. */
export function trackRestore(attempt: Promise<RestoreOutcome>): void {
    // A rejection here must never surface as an unhandled rejection or block the
    // sheet's decision — a failed restore is simply "nothing to report".
    pending = attempt.catch(() => ({ status: 'none' }) as RestoreOutcome);
}

/** Resolves with what the launch's restore did. Safe to call before it finishes. */
export function restoreOutcome(): Promise<RestoreOutcome> {
    return pending;
}

/** Test-only: forget the recorded attempt between cases. */
export function resetRestoreSignalForTests(): void {
    pending = Promise.resolve({ status: 'none' });
}
