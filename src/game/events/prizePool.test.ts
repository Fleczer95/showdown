import { PROGRESSION_MASCOT_COLORS } from '../progression/mascotColors';
import { PROGRESSION_THEMES } from '../progression/themes';
import { MASCOT_PALETTE } from '../mascot/look';
import { eventRewardTitleKey } from './access';
import en from '../../i18n/locales/en.json';
import pl from '../../i18n/locales/pl.json';

const POOL = [
    'mascot-fur-pumpkin',
    'mascot-fur-blackcat',
    'mascot-suit-witch',
    'mascot-accent-slime',
    'mascot-accent-blood',
    'mascot-mic-bone',
    'theme-haunt',
];

const lookup = (source: object, key: string) =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], source);

test('every pool reward resolves to a title key present in both locales', () => {
    for (const id of POOL) {
        const key = eventRewardTitleKey(id);
        expect(key).toBeDefined();
        expect(lookup(en, key!)).toEqual(expect.any(String));
        expect(lookup(pl, key!)).toEqual(expect.any(String));
    }
});

test('each new mascot colour has a swatch in its slot', () => {
    for (const reward of PROGRESSION_MASCOT_COLORS.filter((c) => POOL.includes(c.id))) {
        const swatches = MASCOT_PALETTE[reward.slot].map((c) => c.id);
        expect(swatches).toContain(reward.colorId);
    }
});

test('the haunt theme is bound and event-only', () => {
    const haunt = PROGRESSION_THEMES.find((t) => t.id === 'theme-haunt');
    expect(haunt).toBeDefined();
    expect(haunt!.value).toBe('haunt');
    expect(haunt!.tokens).toBeDefined();
});

test('no pool reward is sold in the store', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { STORE_CATALOG } = require('../../data/store/catalog') as typeof import('../../data/store/catalog');
    const sold = new Set(STORE_CATALOG.map((entry: { id: string }) => entry.id));
    for (const id of POOL) expect(sold.has(id)).toBe(false);
});
