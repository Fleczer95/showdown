export interface ChallengeTransitionEndEvent {
    data: { closing: boolean };
}

interface AutoShareAfterTransitionArgs {
    challengeId: string;
    subscribe: (listener: (event: ChallengeTransitionEndEvent) => void) => () => void;
    consume: () => void;
    share: (challengeId: string) => Promise<void>;
    onError: (error: unknown) => void;
    onFallback?: () => void;
    fallbackMs?: number;
}

export const AUTO_SHARE_FALLBACK_MS = 1_000;

/**
 * Share once, after the opening native-stack transition. The listener never
 * awaits the platform share promise, so navigation and challenge loading remain
 * independent even if an iOS share extension fails to settle.
 */
export function registerAutoShareAfterTransition({
    challengeId,
    subscribe,
    consume,
    share,
    onError,
    onFallback,
    fallbackMs = AUTO_SHARE_FALLBACK_MS,
}: AutoShareAfterTransitionArgs): () => void {
    let shared = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;

    const shareOnce = (usedFallback: boolean) => {
        if (shared) return;
        shared = true;
        if (fallback) clearTimeout(fallback);
        if (usedFallback) onFallback?.();
        consume();
        void share(challengeId).catch(onError);
    };

    const unsubscribe = subscribe((event) => {
        if (event.data.closing) return;
        shareOnce(false);
    });
    // `transitionEnd` can be missed if the screen subscribes after a very fast
    // native transition. A delayed, idempotent fallback still presents Share only
    // after the normal transition window and can never double-share on a late event.
    fallback = setTimeout(() => shareOnce(true), fallbackMs);

    return () => {
        if (fallback) clearTimeout(fallback);
        unsubscribe();
    };
}
