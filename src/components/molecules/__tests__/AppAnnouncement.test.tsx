import React from 'react';
import { Modal, View as MockView } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../../theme';
import { TranslationProvider } from '../../../i18n';
import AppAnnouncement from '../AppAnnouncement';
import { resetAppAnnouncementForTests } from '../../../hooks/useAppAnnouncement';

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

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../../../game/progression', () => ({ loadStats: () => ({ runsPlayed: 0 }) }));
jest.mock('../../../game/mascot/Mascot', () => ({ Mascot: () => <MockView /> }));
jest.mock('../../../game/mascot/equippedLook', () => ({
    getEquippedLook: () => ({ fur: 'a', suit: 'b', accent: 'c', mic: 'd' }),
}));

jest.mock('../../../services/appUpdate/updateCheck', () => ({
    checkStoreVersion: jest.fn().mockResolvedValue(null),
    openStoreListing: jest.fn(),
}));

jest.mock('../../../services/appUpdate/seenVersions', () => ({
    ...jest.requireActual('../../../services/appUpdate/seenVersions'),
    readWhatsNewSeen: jest.fn(() => '0.0.1'),
    markWhatsNewSeen: jest.fn(),
    readUpdatePromptSeen: jest.fn(),
    markUpdatePromptSeen: jest.fn(),
}));

jest.mock('../../../data/whatsNew', () => ({
    WHATS_NEW: { version: '1.0.0', highlights: [{ emoji: '🏆', key: 'whatsNew.cta' }] },
}));

function tree() {
    return (
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
        >
            <ThemeProvider>
                <TranslationProvider>
                    <AppAnnouncement />
                </TranslationProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

describe('AppAnnouncement', () => {
    beforeEach(() => resetAppAnnouncementForTests());

    /**
     * BottomSheet animates itself out over ~250ms, but only while it is still in
     * the tree. Returning null the moment the announcement clears used to tear
     * it out synchronously — 1 Modal became 0 in the same tick — so the sheet
     * blinked away instead of sliding.
     */
    it('keeps the sheet in the tree through its exit animation', () => {
        const view = render(tree());
        expect(view.UNSAFE_queryAllByType(Modal)).toHaveLength(1);
        expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);

        act(() => view.UNSAFE_getByType(Modal).props.onRequestClose());

        // Still mounted, now animating out rather than vanishing.
        expect(view.UNSAFE_queryAllByType(Modal)).toHaveLength(1);
    });

    it('drops the sheet once it reports that it has finished leaving', () => {
        const view = render(tree());
        act(() => view.UNSAFE_getByType(Modal).props.onRequestClose());
        expect(view.UNSAFE_queryAllByType(Modal)).toHaveLength(1);

        // BottomSheet calls onDismissComplete once the exit has finished.
        act(() => view.UNSAFE_getByType(Modal).props.onDismiss?.());

        expect(view.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
    });
});
