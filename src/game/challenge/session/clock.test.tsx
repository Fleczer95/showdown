import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useSessionCheckpoint } from './useSessionCheckpoint';
import { getSession, checkpointSession } from './store';

jest.mock('./store', () => ({ getSession: jest.fn(), checkpointSession: jest.fn(() => true) }));
jest.mock('./recovery', () => ({ settleCompletion: jest.fn() }));

let appState: (value: AppStateStatus) => void;
beforeEach(() => {
    jest.useFakeTimers().setSystemTime(1000);
    jest.mocked(getSession).mockReturnValue({
        status: 'active',
        elapsedMs: 500,
        checkpoint: { answer: null },
        record: { expiresAt: 100000 },
    } as never);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
        appState = listener;
        return { remove: jest.fn() };
    });
    jest.mocked(checkpointSession).mockClear();
    jest.mocked(checkpointSession).mockImplementation((id, checkpoint, elapsedMs) => {
        jest.mocked(getSession).mockReturnValue({ ...getSession(id)!, checkpoint, elapsedMs });
        return true;
    });
});
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('background and normal pause preserve active time while excluding time away', () => {
    const hook = renderHook(
        ({ running }: { running: boolean }) => useSessionCheckpoint('session', 'question-1', running, jest.fn()),
        { initialProps: { running: true } },
    );
    act(() => jest.advanceTimersByTime(1500));
    expect(hook.result.current.elapsed()).toBe(2000);
    act(() => appState('background'));
    expect(checkpointSession).toHaveBeenLastCalledWith('session', { answer: null }, 2000);
    act(() => jest.advanceTimersByTime(20000));
    hook.rerender({ running: true }); // e.g. a background animation settles
    expect(hook.result.current.elapsed()).toBe(2000);
    act(() => appState('active'));
    act(() => jest.advanceTimersByTime(1000));
    expect(hook.result.current.elapsed()).toBe(3000);
    act(() => appState('background'));
    expect(checkpointSession).toHaveBeenLastCalledWith('session', { answer: null }, 3000);
    act(() => appState('active'));
    act(() => hook.result.current.pause());
    hook.rerender({ running: false });
    act(() => jest.advanceTimersByTime(10000));
    expect(hook.result.current.elapsed()).toBe(3000);
    hook.rerender({ running: true });
    act(() => jest.advanceTimersByTime(1000));
    expect(hook.result.current.elapsed()).toBe(4000);
    hook.unmount();
    expect(checkpointSession).toHaveBeenLastCalledWith('session', { answer: null }, 4000);
});

test('a decorative reveal cannot overwrite the logical decision committed before it', () => {
    const hook = renderHook(
        ({ running }: { running: boolean }) => useSessionCheckpoint('session', 'q1', running, jest.fn()),
        { initialProps: { running: true } },
    );
    act(() => hook.result.current.commit({ question: 2 }, undefined, true));
    expect(checkpointSession).toHaveBeenLastCalledWith('session', { question: 2 }, 0, undefined);
    // Background may arrive BEFORE React has committed the next UI frame.
    act(() => appState('background'));
    hook.rerender({ running: false });
    hook.unmount();
    expect(checkpointSession).toHaveBeenLastCalledWith('session', { question: 2 }, 0, undefined);
});

test('wall-clock deadline expires even while active timing is paused', () => {
    jest.mocked(getSession).mockReturnValue({
        status: 'active',
        elapsedMs: 0,
        record: { expiresAt: 100000, event: { endsAt: 2000 } },
    } as never);
    const expire = jest.fn();
    const hook = renderHook(() => useSessionCheckpoint('session', 'q1', false, expire));
    act(() => jest.advanceTimersByTime(1000));
    expect(hook.result.current.canPlay()).toBe(false);
    expect(expire).toHaveBeenCalled();
    hook.unmount();
});
