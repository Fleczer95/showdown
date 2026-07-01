import { LINES } from './lines';
import en from '../../../i18n/locales/en.json';
import pl from '../../../i18n/locales/pl.json';

function get(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

const allKeys = Array.from(
    new Set(Object.values(LINES).flatMap((p) => [...p.keys, ...(p.escalation?.keys ?? [])])),
);

describe('mascot line i18n completeness', () => {
    it.each(allKeys)('EN has %s', (key) => {
        expect(typeof get(en, key)).toBe('string');
    });
    it.each(allKeys)('PL has %s', (key) => {
        expect(typeof get(pl, key)).toBe('string');
    });
});
