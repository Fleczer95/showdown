import { seedUnlockedPack } from './packHistory';
import { getPackSeedTargets } from '../data/store/catalog';
import { seedHistory } from './history';

jest.mock('../data/store/catalog', () => ({
    getPackSeedTargets: jest.fn(),
}));
jest.mock('./history', () => ({
    seedHistory: jest.fn(),
}));

const mockTargets = getPackSeedTargets as jest.MockedFunction<typeof getPackSeedTargets>;
const mockSeed = seedHistory as jest.MockedFunction<typeof seedHistory>;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('seedUnlockedPack', () => {
    it("seeds the pack's questions into the owning game's history", () => {
        mockTargets.mockReturnValue({ gameId: 'the-ladder', ids: ['q1', 'q2'] });
        seedUnlockedPack('pack-ladder-ancient-history');
        expect(mockSeed).toHaveBeenCalledWith('the-ladder', ['q1', 'q2']);
    });

    it('does nothing for a non-pack id (e.g. a theme)', () => {
        mockTargets.mockReturnValue(undefined);
        seedUnlockedPack('theme-midnight');
        expect(mockSeed).not.toHaveBeenCalled();
    });
});
