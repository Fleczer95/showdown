import { selectHomeMascotMessage, type HomeMascotMessageId, type HomeMascotMessageMemory } from './homeMessages';

function memory(seenIds: HomeMascotMessageId[] = []): HomeMascotMessageMemory {
    const seen = new Set<HomeMascotMessageId>(seenIds);
    return {
        hasSeen: (id) => seen.has(id),
        markSeen: (id) => seen.add(id),
    };
}

describe('selectHomeMascotMessage', () => {
    it('shows the offline limit first when there is a store action', () => {
        const msg = selectHomeMascotMessage(
            { streak: 30, offlineRunsLeft: 0, canUpsell: true },
            memory(),
        );

        expect(msg).toMatchObject({ id: 'offline-limit', action: 'store' });
    });

    it('does not show the offline limit when there is nothing to upsell', () => {
        const msg = selectHomeMascotMessage(
            { streak: 0, offlineRunsLeft: 0, canUpsell: false },
            memory(['welcome']),
        );

        expect(msg).toBeNull();
    });

    it('selects the highest unseen streak milestone reached', () => {
        const msg = selectHomeMascotMessage(
            { streak: 30, offlineRunsLeft: 2, canUpsell: true },
            memory(['streak-30']),
        );

        expect(msg).toMatchObject({ id: 'streak-7', action: 'progress' });
    });

    it('falls back to the one-time welcome message', () => {
        const msg = selectHomeMascotMessage(
            { streak: 0, offlineRunsLeft: 2, canUpsell: true },
            memory(),
        );

        expect(msg).toMatchObject({ id: 'welcome' });
    });

    it('can include seen messages for manual mascot taps', () => {
        const msg = selectHomeMascotMessage(
            { streak: 0, offlineRunsLeft: 2, canUpsell: true },
            memory(['welcome']),
            { includeSeen: true },
        );

        expect(msg).toMatchObject({ id: 'welcome' });
    });
});
