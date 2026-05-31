import { createDeck, type History } from './deck';

interface Item {
    id: string;
}

const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

/** Deterministic rng cycling through a fixed sequence in [0, 1). */
function seededRng(seq: number[]): () => number {
    let i = 0;
    return () => seq[i++ % seq.length];
}

describe('createDeck', () => {
    it('returns every item exactly once', () => {
        const deck = createDeck(items, {}, seededRng([0]));
        expect(deck.map((i) => i.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    });

    it('orders least-shown first (lower counts before higher)', () => {
        const history: History = { a: 2, b: 0, c: 1, d: 2 };
        const deck = createDeck(items, history, seededRng([0]));
        const counts = deck.map((i) => history[i.id] ?? 0);
        // Counts must be non-decreasing across the deck.
        for (let k = 1; k < counts.length; k++) {
            expect(counts[k]).toBeGreaterThanOrEqual(counts[k - 1]);
        }
        // The single least-shown item leads.
        expect(deck[0].id).toBe('b');
    });

    it('treats missing ids as count 0 (unseen items lead)', () => {
        const history: History = { a: 5 };
        const deck = createDeck(items, history, seededRng([0]));
        // a (count 5) must be last; the three unseen come first.
        expect(deck[deck.length - 1].id).toBe('a');
    });

    it('cycles the whole pool before repeating: take-N twice covers everything', () => {
        // Pool of 4, runs of 2. Simulate display-time counting between runs.
        const history: History = {};
        const run1 = createDeck(items, history, seededRng([0])).slice(0, 2);
        run1.forEach((i) => (history[i.id] = (history[i.id] ?? 0) + 1));
        const run2 = createDeck(items, history, seededRng([0])).slice(0, 2);
        run2.forEach((i) => (history[i.id] = (history[i.id] ?? 0) + 1));

        const seen = [...run1, ...run2].map((i) => i.id).sort();
        expect(seen).toEqual(['a', 'b', 'c', 'd']); // all four, no repeats yet
    });

    it('is deterministic for a given rng', () => {
        const a = createDeck(items, {}, seededRng([0.1, 0.6, 0.3, 0.9]));
        const b = createDeck(items, {}, seededRng([0.1, 0.6, 0.3, 0.9]));
        expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    });
});
