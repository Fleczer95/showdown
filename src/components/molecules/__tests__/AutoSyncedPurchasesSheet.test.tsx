import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { TranslationProvider } from '../../../i18n';
import AutoSyncedPurchasesSheet from '../AutoSyncedPurchasesSheet';

const mockDismissAutoSyncNotice = jest.fn();
let mockAutoSyncNotice = {
    itemIds: ['theme-cyberpunk', 'theme-ocean', 'theme-forest', 'mascot-arctic'],
    premium: true,
};

jest.mock('../../../hooks/store/useStore', () => ({
    useStore: () => ({
        autoSyncNotice: mockAutoSyncNotice,
        dismissAutoSyncNotice: mockDismissAutoSyncNotice,
    }),
}));

jest.mock('../BottomSheet', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
    return {
        __esModule: true,
        default: ({ visible, title, children, testID }: any) =>
            visible ? (
                <View testID={testID}>
                    <Text>{title}</Text>
                    {children}
                </View>
            ) : null,
    };
});

function sheetTree() {
    return (
        <ThemeProvider>
            <TranslationProvider>
                <AutoSyncedPurchasesSheet />
            </TranslationProvider>
        </ThemeProvider>
    );
}

describe('AutoSyncedPurchasesSheet', () => {
    beforeEach(() => {
        mockDismissAutoSyncNotice.mockClear();
        mockAutoSyncNotice = {
            itemIds: ['theme-cyberpunk', 'theme-ocean', 'theme-forest', 'mascot-arctic'],
            premium: true,
        };
    });

    it('lists synced entitlements and caps long lists at four items', () => {
        const view = render(sheetTree());

        expect(view.getByTestId('auto-sync-purchases-sheet')).toBeTruthy();
        expect(view.getByText('Purchase synced', { includeHiddenElements: true })).toBeTruthy();
        expect(view.getByText('Cyberpunk', { includeHiddenElements: true })).toBeTruthy();
        expect(view.getByText('Ocean Breeze', { includeHiddenElements: true })).toBeTruthy();
        expect(view.getByText('Enchanted Forest', { includeHiddenElements: true })).toBeTruthy();
        expect(view.getByText('Arctic Costume', { includeHiddenElements: true })).toBeTruthy();
        expect(view.getByText('+1 more', { includeHiddenElements: true })).toBeTruthy();

        fireEvent.press(view.getByText('Got it', { includeHiddenElements: true }));
        expect(mockDismissAutoSyncNotice).toHaveBeenCalledTimes(1);
    });

    it('names Premium when a subscription is newly synced', () => {
        mockAutoSyncNotice = { itemIds: [], premium: true };
        const view = render(sheetTree());

        expect(view.getByText('Showdown Premium', { includeHiddenElements: true })).toBeTruthy();
    });
});
