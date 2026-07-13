import { Share } from 'react-native';
import { challengeUrl, shareChallenge } from './share';

afterEach(() => jest.restoreAllMocks());

describe('challenge sharing', () => {
    it('builds the public challenge link', () => {
        expect(challengeUrl('challenge-123')).toBe('https://showdown.lebene.pl/c/challenge-123');
    });

    it('opens the native share sheet with the challenge link', async () => {
        const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

        await shareChallenge('challenge-123');

        expect(share).toHaveBeenCalledWith({
            message: 'https://showdown.lebene.pl/c/challenge-123',
            url: 'https://showdown.lebene.pl/c/challenge-123',
        });
    });
});
