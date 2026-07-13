export type ModalDismissalResult = 'dismissed' | 'timeout';

export interface ModalDismissalBarrier {
    promise: Promise<ModalDismissalResult>;
    dismiss: () => void;
}

/**
 * Resolve when a native modal confirms that it has gone away, with a watchdog
 * so a missed native event can never leave challenge creation stuck forever.
 */
export function createModalDismissalBarrier(timeoutMs = 1_000): ModalDismissalBarrier {
    let settled = false;
    let resolvePromise: (result: ModalDismissalResult) => void = () => undefined;
    const promise = new Promise<ModalDismissalResult>((resolve) => {
        resolvePromise = resolve;
    });

    const settle = (result: ModalDismissalResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise(result);
    };

    const timer = setTimeout(() => settle('timeout'), timeoutMs);
    return { promise, dismiss: () => settle('dismissed') };
}

/**
 * Start challenge creation immediately while the nickname modal animates out,
 * but do not allow navigation or native UI errors until that modal is gone.
 */
export async function createWhileModalDismisses<T>(
    create: () => Promise<T>,
    dismissal: Promise<ModalDismissalResult>,
): Promise<{ value: T; dismissal: ModalDismissalResult }> {
    const creation = Promise.resolve()
        .then(create)
        .then(
            (value) => ({ ok: true as const, value }),
            (error: unknown) => ({ ok: false as const, error }),
        );
    const [outcome, dismissalResult] = await Promise.all([creation, dismissal]);
    if (!outcome.ok) throw outcome.error;
    return { value: outcome.value, dismissal: dismissalResult };
}
