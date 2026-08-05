import { restoreFromCloud, pushToCloud } from './cloudSave';
import { defaultStats } from '../../game/progression/defaults';

jest.mock('../../../modules/game-services', () => ({
    gameServicesAvailable: true,
    readCloudSave: jest.fn(),
    writeCloudSave: jest.fn().mockResolvedValue(true),
}));

const native = jest.requireMock('../../../modules/game-services');

describe('restoreFromCloud', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        native.writeCloudSave.mockResolvedValue(true);
    });

    it('merges the remote save into the stats it was handed', async () => {
        native.readCloudSave.mockResolvedValue(JSON.stringify({ ...defaultStats(), lifetimeXp: 900 }));

        const merged = await restoreFromCloud({ ...defaultStats(), lifetimeXp: 400 });
        expect(merged?.lifetimeXp).toBe(900);
    });

    it('pushes the merged union back so both devices converge', async () => {
        native.readCloudSave.mockResolvedValue(JSON.stringify({ ...defaultStats(), runsPlayed: 3 }));

        await restoreFromCloud({ ...defaultStats(), runsPlayed: 2 });
        expect(native.writeCloudSave).toHaveBeenCalledWith(expect.stringContaining('"runsPlayed":5'));
    });

    it('treats a partial remote payload as zeros, never doubling local counters', async () => {
        // An older app version wrote a slot without challengesPlayed.
        native.readCloudSave.mockResolvedValue(JSON.stringify({ lifetimeXp: 100, runsPlayed: 1 }));

        const merged = await restoreFromCloud({ ...defaultStats(), runsPlayed: 4, challengesPlayed: 2 });
        expect(merged?.runsPlayed).toBe(5);
        expect(merged?.challengesPlayed).toBe(2);
    });

    it('returns null when the slot is empty', async () => {
        native.readCloudSave.mockResolvedValue(null);

        expect(await restoreFromCloud(defaultStats())).toBeNull();
        expect(native.writeCloudSave).not.toHaveBeenCalled();
    });

    it('returns null on a corrupt payload rather than resetting progress', async () => {
        native.readCloudSave.mockResolvedValue('{not json');

        expect(await restoreFromCloud({ ...defaultStats(), lifetimeXp: 400 })).toBeNull();
        expect(native.writeCloudSave).not.toHaveBeenCalled();
    });

    it('ignores a payload that is valid JSON but not an object', async () => {
        native.readCloudSave.mockResolvedValue('"just a string"');

        expect(await restoreFromCloud({ ...defaultStats(), lifetimeXp: 400 })).toBeNull();
    });
});

describe('pushToCloud', () => {
    beforeEach(() => jest.clearAllMocks());

    it('serializes the stats it is handed', async () => {
        await pushToCloud({ ...defaultStats(), lifetimeXp: 123 });
        expect(native.writeCloudSave).toHaveBeenCalledWith(expect.stringContaining('"lifetimeXp":123'));
    });
});
