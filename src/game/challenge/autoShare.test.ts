import {
    AUTO_SHARE_FALLBACK_MS,
    registerAutoShareAfterTransition,
    type ChallengeTransitionEndEvent,
} from './autoShare';

afterEach(() => {
    jest.useRealTimers();
});

describe('automatic challenge sharing', () => {
    it('shares once after the opening transition and ignores closing events', () => {
        let listener: ((event: ChallengeTransitionEndEvent) => void) | undefined;
        const consume = jest.fn();
        const share = jest.fn(() => new Promise<void>(() => undefined));
        const unsubscribe = jest.fn();

        const cleanup = registerAutoShareAfterTransition({
            challengeId: 'challenge-1',
            subscribe: (next) => {
                listener = next;
                return unsubscribe;
            },
            consume,
            share,
            onError: jest.fn(),
        });

        listener?.({ data: { closing: true } });
        expect(share).not.toHaveBeenCalled();

        listener?.({ data: { closing: false } });
        listener?.({ data: { closing: false } });
        expect(consume).toHaveBeenCalledTimes(1);
        expect(share).toHaveBeenCalledTimes(1);
        expect(share).toHaveBeenCalledWith('challenge-1');
        cleanup();
    });

    it('reports a rejected share without coupling it to the transition', async () => {
        let listener: ((event: ChallengeTransitionEndEvent) => void) | undefined;
        const error = new Error('share failed');
        const onError = jest.fn();

        const cleanup = registerAutoShareAfterTransition({
            challengeId: 'challenge-1',
            subscribe: (next) => {
                listener = next;
                return jest.fn();
            },
            consume: jest.fn(),
            share: async () => {
                throw error;
            },
            onError,
        });

        listener?.({ data: { closing: false } });
        await Promise.resolve();
        expect(onError).toHaveBeenCalledWith(error);
        cleanup();
    });

    it('falls back when the opening transition event is missed without double-sharing', () => {
        jest.useFakeTimers();
        let listener: ((event: ChallengeTransitionEndEvent) => void) | undefined;
        const consume = jest.fn();
        const share = jest.fn(async () => undefined);
        const onFallback = jest.fn();

        const cleanup = registerAutoShareAfterTransition({
            challengeId: 'challenge-1',
            subscribe: (next) => {
                listener = next;
                return jest.fn();
            },
            consume,
            share,
            onError: jest.fn(),
            onFallback,
        });

        jest.advanceTimersByTime(AUTO_SHARE_FALLBACK_MS);
        expect(onFallback).toHaveBeenCalledTimes(1);
        expect(consume).toHaveBeenCalledTimes(1);
        expect(share).toHaveBeenCalledTimes(1);

        listener?.({ data: { closing: false } });
        expect(consume).toHaveBeenCalledTimes(1);
        expect(share).toHaveBeenCalledTimes(1);
        cleanup();
    });

    it('cancels the fallback and listener on unmount', () => {
        jest.useFakeTimers();
        const share = jest.fn(async () => undefined);
        const unsubscribe = jest.fn();

        const cleanup = registerAutoShareAfterTransition({
            challengeId: 'challenge-1',
            subscribe: () => unsubscribe,
            consume: jest.fn(),
            share,
            onError: jest.fn(),
        });

        cleanup();
        jest.advanceTimersByTime(AUTO_SHARE_FALLBACK_MS);
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(share).not.toHaveBeenCalled();
    });
});
