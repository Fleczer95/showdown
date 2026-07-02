import { DEFAULT_LOOK } from './look';
import {
    MascotLookActionType,
    chooseMascotColor,
    chooseMascotPreset,
    isMascotColorLocked,
    mascotPresetModels,
    mascotSwatchesForSlot,
} from './lookPolicy';

const lockedState = {
    purchasedItemIds: new Set<string>(),
    unlockedRewards: new Set<string>(),
};

describe('mascot look policy', () => {
    it('routes locked purchasable colors to their store item', () => {
        expect(chooseMascotColor(DEFAULT_LOOK, 'fur', 'fur.arctic', lockedState)).toEqual({
            type: MascotLookActionType.OpenStore,
            itemId: 'mascot-arctic',
        });
    });

    it('routes locked earned colors to the progression reward', () => {
        expect(chooseMascotColor(DEFAULT_LOOK, 'mic', 'mic.platinum', lockedState)).toEqual({
            type: MascotLookActionType.OpenProgress,
            rewardId: 'mascot-mic-platinum',
        });
    });

    it('equips a color when its store item is owned', () => {
        const action = chooseMascotColor(DEFAULT_LOOK, 'fur', 'fur.arctic', {
            purchasedItemIds: new Set(['mascot-arctic']),
            unlockedRewards: new Set<string>(),
        });

        expect(action).toEqual({
            type: MascotLookActionType.Equip,
            look: { ...DEFAULT_LOOK, fur: 'fur.arctic' },
        });
    });

    it('equips an earned color when its progression reward is unlocked', () => {
        expect(
            isMascotColorLocked('mic.platinum', {
                purchasedItemIds: new Set<string>(),
                unlockedRewards: new Set(['mascot-mic-platinum']),
            }),
        ).toBe(false);
    });

    it('marks swatches as selected and sorts unlocked colors before locked ones', () => {
        const swatches = mascotSwatchesForSlot('fur', DEFAULT_LOOK, lockedState);

        expect(swatches[0]).toMatchObject({ id: 'fur.orange', selected: true, locked: false });
        expect(swatches.slice(1).every((swatch) => swatch.locked)).toBe(true);
    });

    it('models presets and routes locked presets by their first locked color', () => {
        const models = mascotPresetModels(DEFAULT_LOOK, lockedState);
        const classic = models.find((model) => model.preset.id === 'classic');
        const arctic = models.find((model) => model.preset.id === 'arctic');

        expect(classic).toMatchObject({ locked: false, selected: true });
        expect(arctic).toMatchObject({ locked: true, selected: false });
        expect(chooseMascotPreset(arctic!.preset, lockedState)).toEqual({
            type: MascotLookActionType.OpenStore,
            itemId: 'mascot-arctic',
        });
    });

    it('equips an unlocked preset and asks the caller to announce it', () => {
        const arctic = mascotPresetModels(DEFAULT_LOOK, {
            purchasedItemIds: new Set(['mascot-arctic']),
            unlockedRewards: new Set<string>(),
        }).find((model) => model.preset.id === 'arctic')!;

        expect(
            chooseMascotPreset(arctic.preset, {
                purchasedItemIds: new Set(['mascot-arctic']),
                unlockedRewards: new Set<string>(),
            }),
        ).toEqual({
            type: MascotLookActionType.Equip,
            look: arctic.preset.look,
            announceLookEquipped: true,
        });
    });
});
