import { renderHook } from '@testing-library/react-native';
import { useSound } from './useSound';

const mockPlay = jest.fn();
const mockSeekTo = jest.fn();

// The players are built when `useSound` is imported, before these consts initialize,
// so the stubs have to reach for the spies at call time rather than capture them.
jest.mock('expo-audio', () => ({
    createAudioPlayer: () => ({
        play: (...args: unknown[]) => mockPlay(...args),
        seekTo: (...args: unknown[]) => mockSeekTo(...args),
    }),
}));

jest.mock('./useSettings', () => ({ useSettings: () => ({ soundEffects: true }) }));

describe('useSound', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('plays the requested effect', () => {
        const { result } = renderHook(() => useSound());

        result.current.play('correct');

        expect(mockSeekTo).toHaveBeenCalledWith(0);
        expect(mockPlay).toHaveBeenCalledTimes(1);
    });

    it('stays silent instead of throwing when the audio session cannot activate', () => {
        // iOS refuses to activate the session in the background or under an
        // interruption, and the native call is synchronous, so it throws into render.
        mockPlay.mockImplementation(() => {
            throw new Error('UnexpectedException: Session activation failed');
        });
        const { result } = renderHook(() => useSound());

        expect(() => result.current.play('correct')).not.toThrow();
    });
});
