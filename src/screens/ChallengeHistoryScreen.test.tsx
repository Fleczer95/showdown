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

jest.mock('../game/challenge/rematchSync', () => ({
    syncIncomingRematches: jest.fn(() => Promise.resolve([])),
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

it('visually distinguishes my turn, waiting for the opponent, and completed', () => {
    jest.mocked(listChallenges).mockReturnValue([
        { ...stub, id: 'turn', played: false },
        { ...stub, id: 'waiting', played: true, opponentPlayed: false },
        { ...stub, id: 'completed', played: true, opponentPlayed: true },
    ]);

    const screen = render(<ChallengeHistoryScreen />);

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('challenge.history.yourTurn');
    expect(tree).toContain('challenge.history.waitingOpponent');
    expect(tree).toContain('challenge.history.completed');
});

it('keeps a directed rematch private and labels its opponent', () => {
    jest.mocked(listChallenges).mockReturnValue([
        { ...stub, opponent: 'Anna', isRematch: true, sourceChallengeId: 'source' },
    ]);

    const screen = render(<ChallengeHistoryScreen />);

    expect(screen.queryByLabelText('Share challenge link')).toBeNull();
    fireEvent.press(screen.getByLabelText('vs Anna'));
    expect(mockNavigate).toHaveBeenCalledWith('Challenge', { challengeId: 'challenge-123' });
});
