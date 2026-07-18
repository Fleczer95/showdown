import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { TranslationProvider } from '../../../i18n';
import en from '../../../i18n/locales/en.json';
import Leaderboard from '../Leaderboard';

function leaderboardTree(showTitle?: boolean) {
    return (
        <ThemeProvider>
            <TranslationProvider>
                <Leaderboard gameId='the-ladder' showTitle={showTitle} />
            </TranslationProvider>
        </ThemeProvider>
    );
}

describe('Leaderboard title', () => {
    it('labels embedded boards as Solo Leaderboard by default', () => {
        const screen = render(leaderboardTree());

        expect(screen.getByText(en.leaderboard.title)).toBeTruthy();
    });

    it('lets an owning sheet suppress the duplicate title', () => {
        const screen = render(leaderboardTree(false));

        expect(screen.queryByText(en.leaderboard.title)).toBeNull();
    });
});
