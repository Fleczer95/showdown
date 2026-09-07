import React from 'react';
import { Modal } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import LadderPlayScreen from '../ladder/LadderPlayScreen';
import DropPlayScreen from '../drop/DropPlayScreen';
import WheelPlayScreen from '../wheel/WheelPlayScreen';
import { buildRun } from '../ladder/logic';
import { buildGame } from '../drop/logic';
import { dropQuestions } from '../drop/content';
import { createGame } from '../wheel/logic';

jest.mock('../../i18n/TranslationContext', () => ({
    ...jest.requireActual('../../i18n/TranslationContext'),
    useTranslation: () => ({ t: (key: string) => key, locale: 'en' }),
}));
// This regression exercises state/navigation, not native animation timing.
jest.mock('react-native-reanimated', () => ({
    ...jest.requireActual('react-native-reanimated/mock'),
    useReducedMotion: () => true,
}));
jest.mock('./session/recovery', () => ({ settleCompletion: jest.fn() }));
jest.mock('../events/access', () => ({ useContentAccess: () => [] }));
jest.mock('../wheel/WheelGraphic', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-safe-area-context', () => ({
    ...jest.requireActual('react-native-safe-area-context'),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const onExit = jest.fn();
const challenge = { ownedIds: new Set<string>(), onComplete: jest.fn(), onAbandon: jest.fn() };
const screens = [
    {
        game: 'the-ladder',
        element: () => (
            <LadderPlayScreen
                onExit={onExit}
                challenge={{
                    ...challenge,
                    initial: buildRun(
                        Array.from({ length: 15 }, (_, i) => [
                            {
                                id: `pause-${i}`,
                                prompt: 'Question',
                                options: ['A', 'B', 'C', 'D'],
                                correctIndex: 0,
                            },
                        ]),
                        {},
                    ),
                }}
            />
        ),
    },
    {
        game: 'the-drop',
        element: () => (
            <DropPlayScreen onExit={onExit} challenge={{ ...challenge, initial: buildGame(dropQuestions, {}) }} />
        ),
    },
    {
        game: 'the-wheel',
        element: () => (
            <WheelPlayScreen
                onExit={onExit}
                challenge={{
                    ...challenge,
                    initial: createGame([{ id: 'pause-wheel', phrase: 'TEST', category: 'Test' }]),
                }}
            />
        ),
    },
];

beforeEach(() => jest.clearAllMocks());

test.each(screens)('$game closes the pause dialog without abandoning or completing the run', ({ game, element }) => {
    // Keep the screen mounted after onExit, as it can remain mounted during a
    // native navigation transition. Unmounting must not be the only dismissal.
    const view = render(<ThemeProvider>{element()}</ThemeProvider>);
    const textOptions = { includeHiddenElements: true };
    fireEvent.press(view.getByText(`game.${game}.active.leave`, textOptions));
    expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);
    fireEvent.press(view.getByText('challenge.session.pause', textOptions));
    expect(view.UNSAFE_getByType(Modal).props.visible).toBe(false);
    expect(view.queryByText('challenge.session.pause', textOptions)).toBeNull();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(challenge.onAbandon).not.toHaveBeenCalled();
    expect(challenge.onComplete).not.toHaveBeenCalled();
});
