import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useProgression } from './useProgression';
import { saveStats, loadStats, defaultStats } from '../game/progression';

// The hook's focus refresh needs a navigation container in real use; here the
// subscription is what matters, so focus is stubbed to a no-op.
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: jest.fn(),
}));

// The MMKV mock in jest.setup.js is a stub — `set` stores nothing and
// `getString` always returns undefined — so these cover the subscription, not
// persistence. Reading persisted stats is covered by the progression tests.
describe('useProgression', () => {
    // Found on device: a cloud restore lands while Home is already on screen and
    // focused, so the focus refresh never fires. The player saw "Lv 1 · 0 XP"
    // until they navigated away and back, which reads as lost progress.
    it('re-renders when a restore writes stats after mount', async () => {
        const { result } = renderHook(() => useProgression());
        expect(result.current.level).toBe(1);

        act(() => saveStats({ ...loadStats(), lifetimeXp: 750 }));

        await waitFor(() => expect(result.current.level).toBe(4));
    });

    it('stops listening once unmounted', () => {
        const { result, unmount } = renderHook(() => useProgression());
        unmount();

        // Must not throw by setting state on an unmounted hook.
        expect(() => saveStats({ ...defaultStats(), lifetimeXp: 3600 })).not.toThrow();
        expect(result.current.level).toBe(1);
    });
});
