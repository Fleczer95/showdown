import { createModalDismissalBarrier, createWhileModalDismisses } from './createFlow';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('challenge creation modal barrier', () => {
    it('starts creation immediately but waits for native dismissal before completing', async () => {
        const dismissal = deferred<'dismissed'>();
        const create = jest.fn(async () => 'challenge-1');

        const pending = createWhileModalDismisses(create, dismissal.promise);
        await Promise.resolve();

        expect(create).toHaveBeenCalledTimes(1);
        let completed = false;
        void pending.then(() => {
            completed = true;
        });
        await Promise.resolve();
        expect(completed).toBe(false);

        dismissal.resolve('dismissed');
        await expect(pending).resolves.toEqual({ value: 'challenge-1', dismissal: 'dismissed' });
    });

    it('waits for dismissal before surfacing a fast creation error', async () => {
        const dismissal = deferred<'dismissed'>();
        const error = new Error('create failed');
        const pending = createWhileModalDismisses(async () => {
            throw error;
        }, dismissal.promise);

        let rejected = false;
        void pending.catch(() => {
            rejected = true;
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(rejected).toBe(false);

        dismissal.resolve('dismissed');
        await expect(pending).rejects.toBe(error);
    });

    it('uses a watchdog when the native dismissal event never arrives', async () => {
        jest.useFakeTimers();
        const barrier = createModalDismissalBarrier(1_000);

        const result = expect(barrier.promise).resolves.toBe('timeout');
        await jest.advanceTimersByTimeAsync(1_000);
        await result;
        jest.useRealTimers();
    });

    it('settles a dismissal exactly once and cancels its watchdog', async () => {
        jest.useFakeTimers();
        const barrier = createModalDismissalBarrier(1_000);

        barrier.dismiss();
        barrier.dismiss();
        await expect(barrier.promise).resolves.toBe('dismissed');
        await jest.advanceTimersByTimeAsync(1_000);
        await expect(barrier.promise).resolves.toBe('dismissed');
        jest.useRealTimers();
    });
});
