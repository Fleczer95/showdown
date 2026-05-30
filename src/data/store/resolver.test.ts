import { resolveEntries, resolveEntryState } from './resolver';
import type { StoreEntryBase } from './types';

function entry(overrides: Partial<StoreEntryBase> & Pick<StoreEntryBase, 'id'>): StoreEntryBase {
    return {
        status: 'live',
        tier: 'premium',
        presentation: {
            titleKey: `${overrides.id}.title`,
            descriptionKey: `${overrides.id}.desc`,
            iconName: 'sparkles',
            accentColor: '#000000',
        },
        ...overrides,
    };
}

describe('resolveEntryState', () => {
    const owned = new Set<string>(['owned-pack']);

    it('returns hidden when status is hidden — regardless of tier', () => {
        expect(resolveEntryState({ id: 'a', status: 'hidden', tier: 'free' }, owned)).toBe('hidden');
        expect(resolveEntryState({ id: 'b', status: 'hidden', tier: 'premium' }, owned)).toBe('hidden');
    });

    it('hidden beats ownership — an owned hidden entry still resolves to hidden', () => {
        expect(resolveEntryState({ id: 'owned-pack', status: 'hidden', tier: 'premium' }, owned)).toBe('hidden');
    });

    it('returns playable for a live free entry', () => {
        expect(resolveEntryState({ id: 'a', status: 'live', tier: 'free' }, owned)).toBe('playable');
    });

    it('returns playable for a live premium entry that is owned', () => {
        expect(resolveEntryState({ id: 'owned-pack', status: 'live', tier: 'premium' }, owned)).toBe('playable');
    });

    it('returns locked for a live premium entry that is not owned', () => {
        expect(resolveEntryState({ id: 'other-pack', status: 'live', tier: 'premium' }, owned)).toBe('locked');
    });

    it('treats an empty owned set as nothing owned', () => {
        expect(resolveEntryState({ id: 'owned-pack', status: 'live', tier: 'premium' }, new Set())).toBe('locked');
    });
});

describe('resolveEntries', () => {
    const entries: StoreEntryBase[] = [
        entry({ id: 'free-live', status: 'live', tier: 'free' }),
        entry({ id: 'premium-owned', status: 'live', tier: 'premium' }),
        entry({ id: 'premium-locked', status: 'live', tier: 'premium' }),
        entry({ id: 'hidden-one', status: 'hidden', tier: 'premium' }),
    ];
    const owned = new Set(['premium-owned']);

    it('drops hidden entries by default', () => {
        const result = resolveEntries(entries, owned);
        expect(result.map((r) => r.entry.id)).toEqual(['free-live', 'premium-owned', 'premium-locked']);
    });

    it('keeps hidden entries when includeHidden is set', () => {
        const result = resolveEntries(entries, owned, { includeHidden: true });
        expect(result.map((r) => r.entry.id)).toEqual(['free-live', 'premium-owned', 'premium-locked', 'hidden-one']);
    });

    it('preserves input order', () => {
        const result = resolveEntries([...entries].reverse(), owned, { includeHidden: true });
        expect(result.map((r) => r.entry.id)).toEqual(['hidden-one', 'premium-locked', 'premium-owned', 'free-live']);
    });

    it('computes the boolean flags from state', () => {
        const byId = Object.fromEntries(
            resolveEntries(entries, owned, { includeHidden: true }).map((r) => [r.entry.id, r]),
        );
        expect(byId['free-live']).toMatchObject({
            state: 'playable',
            isPlayable: true,
            isLocked: false,
            isVisible: true,
        });
        expect(byId['premium-owned']).toMatchObject({
            state: 'playable',
            isPlayable: true,
            isLocked: false,
            isVisible: true,
        });
        expect(byId['premium-locked']).toMatchObject({
            state: 'locked',
            isPlayable: false,
            isLocked: true,
            isVisible: true,
        });
        expect(byId['hidden-one']).toMatchObject({
            state: 'hidden',
            isPlayable: false,
            isLocked: false,
            isVisible: false,
        });
    });

    it('returns an empty array for empty input', () => {
        expect(resolveEntries([], owned)).toEqual([]);
    });
});
