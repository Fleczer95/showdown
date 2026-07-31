import React from 'react';
import { View as MockView } from 'react-native';
import { configure, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import AnnouncementSheet, { type AnnouncementSheetProps } from '../AnnouncementSheet';

// The shared `Stack` atom hardcodes importantForAccessibility='no-hide-descendants',
// so every element it wraps is hidden from the default queries. Query hidden
// elements rather than reshaping a shared atom for a test's benefit.
configure({ defaultIncludeHiddenElements: true });

jest.mock('react-native-gesture-handler', () => {
    const { View } = jest.requireActual('react-native');
    let pan: Record<string, jest.Mock>;
    pan = {
        enabled: jest.fn(() => pan),
        activeOffsetY: jest.fn(() => pan),
        onUpdate: jest.fn(() => pan),
        onEnd: jest.fn(() => pan),
    };
    return {
        Gesture: { Pan: jest.fn(() => pan) },
        GestureDetector: ({ children }: { children: React.ReactNode }) => children,
        GestureHandlerRootView: ({ children, ...props }: { children: React.ReactNode }) => (
            <View {...props}>{children}</View>
        ),
    };
});

jest.mock('../../../game/mascot/Mascot', () => ({
    Mascot: () => <MockView testID='mascot' />,
}));

jest.mock('../../../game/mascot/equippedLook', () => ({
    getEquippedLook: () => ({ fur: 'default', suit: 'default', accent: 'default', mic: 'default' }),
}));

function sheetTree(props: AnnouncementSheetProps) {
    return (
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
        >
            <ThemeProvider>
                <AnnouncementSheet {...props} />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

describe('AnnouncementSheet', () => {
    const baseProps: AnnouncementSheetProps = {
        visible: true,
        title: 'A new version is ready',
        ctaLabel: 'Update now',
        onPressCta: jest.fn(),
        onClose: jest.fn(),
    };

    it('renders the title and fires the primary action', () => {
        const onPressCta = jest.fn();
        const { getByText } = render(sheetTree({ ...baseProps, onPressCta }));

        expect(getByText('A new version is ready')).toBeTruthy();
        fireEvent.press(getByText('Update now'));
        expect(onPressCta).toHaveBeenCalledTimes(1);
    });

    it('renders each highlight with its emoji', () => {
        const { getByText } = render(
            sheetTree({
                ...baseProps,
                highlights: [
                    { emoji: '🏆', label: 'Achievements and leaderboards' },
                    { emoji: '🐛', label: 'Two crashes fixed' },
                ],
            }),
        );

        expect(getByText('🏆')).toBeTruthy();
        expect(getByText('Achievements and leaderboards')).toBeTruthy();
        expect(getByText('🐛')).toBeTruthy();
        expect(getByText('Two crashes fixed')).toBeTruthy();
    });

    it('offers a dismiss button only when a label is supplied', () => {
        const onClose = jest.fn();
        const { queryByText, rerender, getByText } = render(sheetTree(baseProps));
        expect(queryByText('Not now')).toBeNull();

        rerender(sheetTree({ ...baseProps, dismissLabel: 'Not now', onClose }));
        fireEvent.press(getByText('Not now'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders the body only when supplied', () => {
        const { queryByText, rerender } = render(sheetTree(baseProps));
        expect(queryByText('Grab the latest build')).toBeNull();

        rerender(sheetTree({ ...baseProps, body: 'Grab the latest build' }));
        expect(queryByText('Grab the latest build')).toBeTruthy();
    });
});
