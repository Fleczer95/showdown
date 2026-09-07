import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useEventNow } from './useEventNow';

let mockFocus: () => () => void;
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (callback: () => () => void) => {
        mockFocus = callback;
    },
}));

test('refreshes on focus and foreground, and stops polling when the screen loses focus', () => {
    jest.useFakeTimers().setSystemTime(1000);
    let onState!: (state: AppStateStatus) => void;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
        onState = listener;
        return { remove };
    });
    try {
        const hook = renderHook(() => useEventNow());
        let blur!: () => void;
        act(() => {
            blur = mockFocus();
        });
        act(() => jest.advanceTimersByTime(60000));
        expect(hook.result.current).toBe(61000);
        act(() => {
            jest.setSystemTime(999999);
            onState('active');
        });
        expect(hook.result.current).toBe(999999);
        act(() => blur());
        expect(remove).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
        act(() => jest.advanceTimersByTime(120000));
        expect(hook.result.current).toBe(999999);
        act(() => {
            blur = mockFocus();
        });
        expect(hook.result.current).toBe(1119999);
        act(() => blur());
        hook.unmount();
    } finally {
        jest.useRealTimers();
        jest.restoreAllMocks();
    }
});
