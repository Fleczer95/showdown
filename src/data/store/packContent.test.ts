import { getOwnedPackContent, getOwnedPackContentBilingual } from './packContent';
import { getPackContent, getPlayablePackIds } from './catalog';

jest.mock('./catalog', () => ({
    getPlayablePackIds: jest.fn(),
    getPackContent: jest.fn(),
}));

const mockPlayable = getPlayablePackIds as jest.MockedFunction<typeof getPlayablePackIds>;
const mockContent = getPackContent as jest.MockedFunction<typeof getPackContent>;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getOwnedPackContent', () => {
    it('returns an empty array when no packs are playable', () => {
        mockPlayable.mockReturnValue([]);
        expect(getOwnedPackContent('the-wheel', 'en', new Set())).toEqual([]);
        expect(mockContent).not.toHaveBeenCalled();
    });

    it('concatenates localized content across every playable pack', () => {
        mockPlayable.mockReturnValue(['pack-a', 'pack-b']);
        mockContent.mockImplementation((id) => (id === 'pack-a' ? ['a1', 'a2'] : ['b1']) as never);

        expect(getOwnedPackContent<string>('the-wheel', 'pl', new Set(['pack-a']))).toEqual(['a1', 'a2', 'b1']);
        expect(mockContent).toHaveBeenCalledWith('pack-a', 'pl');
        expect(mockContent).toHaveBeenCalledWith('pack-b', 'pl');
    });
});

describe('getOwnedPackContentBilingual', () => {
    it('zips each pack\'s parallel en/pl arrays via the provided combiner', () => {
        mockPlayable.mockReturnValue(['pack-a']);
        mockContent.mockImplementation((_id, locale) =>
            (locale === 'en' ? [{ t: 'one' }] : [{ t: 'jeden' }]) as never,
        );

        const zip = (en: { t: string }, pl: { t: string }) => ({ en: en.t, pl: pl.t });
        expect(getOwnedPackContentBilingual('the-drop', new Set(['pack-a']), zip)).toEqual([
            { en: 'one', pl: 'jeden' },
        ]);
    });

    it('skips a pack whose en/pl arrays disagree in length instead of crashing', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockPlayable.mockReturnValue(['pack-bad', 'pack-ok']);
        mockContent.mockImplementation((id, locale) => {
            if (id === 'pack-bad') return (locale === 'en' ? [{ t: 'a' }, { t: 'b' }] : [{ t: 'x' }]) as never;
            return (locale === 'en' ? [{ t: 'c' }] : [{ t: 'y' }]) as never;
        });

        const zip = (en: { t: string }, pl: { t: string }) => ({ en: en.t, pl: pl.t });
        // The malformed pack contributes nothing; the well-formed one still plays.
        expect(getOwnedPackContentBilingual('the-drop', new Set(['pack-bad', 'pack-ok']), zip)).toEqual([
            { en: 'c', pl: 'y' },
        ]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('pack-bad'));
        warn.mockRestore();
    });
});
