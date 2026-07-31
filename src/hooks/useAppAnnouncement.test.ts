import { act, renderHook, waitFor } from '@testing-library/react-native';
import { resetAppAnnouncementForTests, useAppAnnouncement } from './useAppAnnouncement';
import { checkStoreVersion } from '../services/appUpdate/updateCheck';
import {
    markUpdatePromptSeen,
    markWhatsNewSeen,
    readUpdatePromptSeen,
    readWhatsNewSeen,
} from '../services/appUpdate/seenVersions';
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

jest.mock('../services/appUpdate/seenVersions', () => ({
    ...jest.requireActual('../services/appUpdate/seenVersions'),
    readWhatsNewSeen: jest.fn(),
    markWhatsNewSeen: jest.fn(),
    readUpdatePromptSeen: jest.fn(),
    markUpdatePromptSeen: jest.fn(),
}));

const mockCheck = checkStoreVersion as jest.MockedFunction<typeof checkStoreVersion>;
const mockReadWhatsNew = readWhatsNewSeen as jest.MockedFunction<typeof readWhatsNewSeen>;
const mockReadUpdate = readUpdatePromptSeen as jest.MockedFunction<typeof readUpdatePromptSeen>;

describe('useAppAnnouncement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetAppAnnouncementForTests();
        WHATS_NEW.version = APP_VERSION;
        mockCheck.mockResolvedValue(null);
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

    it('shows what is new after an update and marks it seen immediately', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');

        const { result } = renderHook(() => useAppAnnouncement());

        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'whatsNew' }));
        expect(markWhatsNewSeen).toHaveBeenCalledWith(APP_VERSION);
        expect(mockCheck).not.toHaveBeenCalled();
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

    it('clears the announcement on dismiss', async () => {
        mockReadWhatsNew.mockReturnValue('0.0.1');

        const { result } = renderHook(() => useAppAnnouncement());
        await waitFor(() => expect(result.current.announcement).toEqual({ kind: 'whatsNew' }));

        act(() => result.current.dismiss());
        expect(result.current.announcement).toBeNull();
    });
});
