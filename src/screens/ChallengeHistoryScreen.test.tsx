import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChallengeHistoryScreen } from './ChallengeHistoryScreen';
import { listChallenges } from '../game/challenge/log';
import { shareChallenge } from '../game/challenge/share';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
    useFocusEffect: () => undefined,
}));

jest.mock('../responsive/SafeContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../i18n', () => ({
    useTranslation: () => ({
        locale: 'en',
        t: (key: string, options?: { name?: string }) => {
            if (key === 'challenge.history.yours') return 'Challenge you created';
            if (key === 'challenge.history.vs') return `vs ${options?.name ?? ''}`;
            if (key === 'challenge.history.share') return 'Share challenge link';
            return key;
        },
    }),
}));

jest.mock('../game/challenge/log', () => ({
    ...jest.requireActual('../game/challenge/log'),
    listChallenges: jest.fn(),
}));

jest.mock('../game/challenge/share', () => ({
    shareChallenge: jest.fn(() => Promise.resolve()),
}));

const stub = {
    id: 'challenge-123',
    game: 'the-ladder',
    role: 'created' as const,
    opponent: '',
    played: false,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: Number.MAX_SAFE_INTEGER,
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(listChallenges).mockReturnValue([stub]);
});

it('shares an active challenge without opening the history row', () => {
    const { getByLabelText } = render(<ChallengeHistoryScreen />);

    fireEvent.press(getByLabelText('Share challenge link'));

    expect(shareChallenge).toHaveBeenCalledWith('challenge-123');
    expect(mockNavigate).not.toHaveBeenCalledWith('Challenge', { challengeId: 'challenge-123' });

    fireEvent.press(getByLabelText('Challenge you created'));
    expect(mockNavigate).toHaveBeenCalledWith('Challenge', { challengeId: 'challenge-123' });
});
