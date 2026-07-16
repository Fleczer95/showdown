import React from 'react';
import { render } from '@testing-library/react-native';
import { ChallengeHandoff } from './ChallengeHandoff';
import type { GameRunResult } from '../progression';

const run: GameRunResult = { gameId: 'the-ladder', score: 1200, won: false, rungReached: 6 };

describe('ChallengeHandoff', () => {
    it('reports the full result exactly once, including the progression run', () => {
        const onComplete = jest.fn();
        const { rerender } = render(
            <ChallengeHandoff progress={6} score={1200} run={run} onComplete={onComplete} />,
        );
        rerender(<ChallengeHandoff progress={6} score={1200} run={run} onComplete={onComplete} />);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith({ progress: 6, score: 1200, run });
    });
});
