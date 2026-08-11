import { act, renderHook, waitFor } from '@testing-library/react-native';
import { resetAppAnnouncementForTests, useAppAnnouncement } from './useAppAnnouncement';
import { checkStoreVersion } from '../services/appUpdate/updateCheck';
import {
    markUpdatePromptSeen,
    markWhatsNewSeen,
    readUpdatePromptSeen,
    readWhatsNewSeen,
} from '../services/appUpdate/seenVersions';
import { restoreOutcome } from '../services/gameServices/restoreSignal';
import { defaultStats } from '../game/progression/defaults';
import { APP_VERSION } from '../utils/version';
import { WHATS_NEW } from '../data/whatsNew';

// Pin both version sources. The hook's behaviour is a function of how these two
// relate, so tests should state that relationship rather than inherit whatever
// the real build and real notes happen to say.
jest.mock('../utils/version', () => ({ APP_VERSION: '2.0.0' }));

jest.mock('../data/whatsNew', () => ({
    WHATS_NEW: { version: '2.0.0', highlights: [{ emoji: '🏆', key: 'whatsNew.test.highlight' }] },
}));

jest.mock('../services/appUpdate/updateCheck', () => ({
    checkStoreVersion: jest.fn(),
    openStoreListing: jest.fn(),
}));

jest.mock('../services/gameServices/restoreSignal', () => ({ restoreOutcome: jest.fn() }));

let mockIsFocused = true;
jest.mock('@react-navigation/native', () => ({
    useIsFocused: () => mockIsFocused,
}));

let mockRunsPlayed = 0;
jest.mock('../game/progression', () => ({
    loadStats: () => ({ runsPlayed: mockRunsPlayed }),
}));

jest.mock('../services/appUpdate/seenVersions', () => ({
    ...jest.requireActual('../services/appUpdate/seenVersions'),
    readWhatsNewSeen: jest.fn(),
    markWhatsNewSeen: jest.fn(),
    readUpdatePromptSeen: jest.fn(),
    markUpdatePromptSeen: jest.fn(),
}));

const mockCheck = checkStoreVersion as jest.MockedFunction<typeof checkStoreVersion>;
const mockRestore = restoreOutcome as jest.MockedFunction<typeof restoreOutcome>;
const mockReadWhatsNew = readWhatsNewSeen as jest.MockedFunction<typeof readWhatsNewSeen>;
const mockReadUpdate = readUpdatePromptSeen as jest.MockedFunction<typeof readUpdatePromptSeen>;

describe('useAppAnnouncement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAppAnnouncementForTests();
        WHATS_NEW.version = APP_VERSION;
        mockIsFocused = true;
        mockRunsPlayed = 0;
        mockCheck.mockResolvedValue(null);
        mockRestore.mockResolvedValue({ status: 'none' });
        mockReadWhatsNew.mockReturnValue(APP_VERSION);
        mockReadUpdate.mockReturnValue(undefined);
    });

    it('shows nothing on a fresh install and seeds the seen version', async () => {
        mockReadWhatsNew.mockReturnValue(undefined);

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION));
        expect(result.current.announcement).toBeNull();
        expect(mockCheck).not.toHaveBeenCalled();
    });

    it('shows notes to an existing player upgrading into the debut build', async () => {
        mockReadWhatsNew.mockReturnValue(undefined); // key cannot exist before this feature
        mockRunsPlayed = 12; // ...but this player has been here a while

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'whatsNew' }));
        expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION);
    });

    it('does not show the update sheet if the player left Home while the lookup was in flight', async () => {
        let resolveCheck: (value: { available: boolean; storeVersion: string }) => void = () => {};
        mockCheck.mockReturnValue(
            new Promise((resolve) => {
                resolveCheck = resolve;
            }),
        );

        const { result, rerender } = renderHook(() => useAppAnnouncement());
        await waitFor(() => expect(mockCheck).toHaveBeenCalled());

        // The player opens a game. useIsFocused flips and Home re-renders.
        mockIsFocused = false;
        rerender({});

        await act(async () => {
            resolveCheck({ available: true, storeVersion: '9.9.9' });
        });

        expect(result.current.announcement).toBeNull();
        expect(markUpdatePromptSeen).not.toHaveBeenCalled();
    });

    it('still offers the prompt on a later launch after being skipped for focus', async () => {
        let resolveCheck: (value: { available: boolean; storeVersion: string }) => void = () => {};
        mockCheck.mockReturnValue(
            new Promise((resolve) => {
                resolveCheck = resolve;
            }),
        );

        const first = renderHook(() => useAppAnnouncement());
        await waitFor(() => expect(mockCheck).toHaveBeenCalled());
        mockIsFocused = false;
        first.rerender({});
        await act(async () => {
            resolveCheck({ available: true, storeVersion: '9.9.9' });
        });

        // Next launch: the latch was released, so the check runs again.
        mockIsFocused = true;
        mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });
        const second = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(second.result.current.announcement).toEqual({ kind: 'update' }));
        expect(markUpdatePromptSeen).toHaveBeenCalledWith('9.9.9');
    });

    it('shows what is new after an update and marks it seen immediately', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'whatsNew' }));
        expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION);
        expect(mockCheck).not.toHaveBeenCalled();
    });

    it('shows no sheet when the release ships an empty highlight list', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');
        const highlights = WHATS_NEW.highlights;
        WHATS_NEW.highlights = [];

        try {
            const { result } = renderHook(() => useAppAnnouncement());

            await waitFor(() => expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION));
            expect(result.current.announcement).toBeNull();
        } finally {
            WHATS_NEW.highlights = highlights;
        }
    });

    it('stays quiet on a patch that ships no notes, but still advances the key', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');
        WHATS_NEW.version = '0.0.9'; // notes belong to some other build

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION));
        expect(result.current.announcement).toBeNull();
        expect(mockCheck).not.toHaveBeenCalled();
    });

    it('shows the update sheet when the store is ahead, and marks that store version seen', async () => {
        mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'update' }));
        expect(markUpdatePromptSeen).toHaveBeenCalledWith('9.9.9');
    });

    it('does not re-prompt for a store version already seen', async () => {
        mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });
        mockReadUpdate.mockReturnValue('9.9.9');

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(mockCheck).toHaveBeenCalled());
        expect(result.current.announcement).toBeNull();
        expect(markUpdatePromptSeen).not.toHaveBeenCalled();
    });

    it('shows nothing when the store check fails', async () => {
        mockCheck.mockResolvedValue(null);
        mockRestore.mockResolvedValue({ status: 'none' });

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(mockCheck).toHaveBeenCalled());
        expect(result.current.announcement).toBeNull();
    });

    it('decides only once per launch', async () => {
        mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });

        const first = renderHook(() => useAppAnnouncement());
        await waitFor(() => expect(first.result.current.announcement).toEqual({ kind: 'update' }));

        const second = renderHook(() => useAppAnnouncement());
        expect(second.result.current.announcement).toBeNull();
        expect(mockCheck).toHaveBeenCalledTimes(1);
    });

    describe('cloud save outcomes', () => {
        const restoredStats = { ...defaultStats(), lifetimeXp: 900 };

        it('reports a refused write, and outranks the update prompt doing it', async () => {
            // A player whose devices are silently diverging needs to hear that
            // before they hear about a new version.
            mockRestore.mockResolvedValue({ status: 'blocked' });
            mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });

            const { result } = renderHook(() => useAppAnnouncement());

            await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'cloudBlocked' }));
            expect(markUpdatePromptSeen).not.toHaveBeenCalled();
        });

        it('reports a successful restore when nothing else is competing', async () => {
            mockRestore.mockResolvedValue({ status: 'restored', stats: restoredStats });

            const { result } = renderHook(() => useAppAnnouncement());

            await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'cloudRestored' }));
        });

        it('yields to the update prompt — good news can wait a launch', async () => {
            mockRestore.mockResolvedValue({ status: 'restored', stats: restoredStats });
            mockCheck.mockResolvedValue({ available: true, storeVersion: '9.9.9' });

            const { result } = renderHook(() => useAppAnnouncement());

            await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'update' }));
        });

        // The quiet path, and by far the most common one: every launch where the
        // cloud had nothing new must stay silent.
        it.each(['unchanged', 'none'] as const)('stays silent on %s', async (status) => {
            mockRestore.mockResolvedValue({ status });

            const { result } = renderHook(() => useAppAnnouncement());

            await waitFor(() => expect(mockRestore).toHaveBeenCalled());
            expect(result.current.announcement).toBeNull();
        });
    });

    it('clears the announcement on dismiss', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');

        const { result } = renderHook(() => useAppAnnouncement());
        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'whatsNew' }));

        act(() => result.current.dismiss());
        expect(result.current.announcement).toBeNull();
    });
});
