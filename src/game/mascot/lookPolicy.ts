import { mascotSkins } from '../../data/store/mascotSkins';
import { resolveEntryState } from '../../data/store/resolver';
import { PROGRESSION_MASCOT_COLORS } from '../progression/mascotColors';
import {
    MASCOT_PALETTE,
    MASCOT_PRESETS,
    type LookMap,
    type MascotPreset,
    type MascotSlot,
    type MascotSwatch,
} from './look';

export enum MascotLookActionType {
    Equip = 'equip',
    OpenStore = 'openStore',
    OpenProgress = 'openProgress',
}

export type MascotLookAction =
    | { type: MascotLookActionType.Equip; look: LookMap; announceLookEquipped?: boolean }
    | { type: MascotLookActionType.OpenStore; itemId: string }
    | { type: MascotLookActionType.OpenProgress; rewardId: string };

export interface MascotLookPolicyState {
    purchasedItemIds: ReadonlySet<string>;
    unlockedRewards: ReadonlySet<string>;
}

export interface MascotSwatchModel extends MascotSwatch {
    locked: boolean;
    selected: boolean;
}

export interface MascotPresetModel {
    preset: MascotPreset;
    locked: boolean;
    selected: boolean;
}

const rewardByColor = new Map(PROGRESSION_MASCOT_COLORS.map((c) => [c.colorId, c.id]));

function skinForColor(colorId: string) {
    return mascotSkins.find((skin) => skin.unlocks.includes(colorId));
}

function lockedPurchasableColorIds(purchasedItemIds: ReadonlySet<string>): Set<string> {
    const locked = new Set<string>();
    for (const skin of mascotSkins) {
        if (resolveEntryState(skin, purchasedItemIds) === 'locked') {
            for (const id of skin.unlocks) locked.add(id);
        }
    }
    return locked;
}

export function isMascotColorLocked(colorId: string, state: MascotLookPolicyState): boolean {
    const rewardId = rewardByColor.get(colorId);
    if (rewardId) return !state.unlockedRewards.has(rewardId);
    return lockedPurchasableColorIds(state.purchasedItemIds).has(colorId);
}

function actionForLockedColor(colorId: string): MascotLookAction | null {
    const rewardId = rewardByColor.get(colorId);
    if (rewardId) return { type: MascotLookActionType.OpenProgress, rewardId };

    const skin = skinForColor(colorId);
    if (skin) return { type: MascotLookActionType.OpenStore, itemId: skin.id };

    return null;
}

export function chooseMascotColor(
    look: LookMap,
    slot: MascotSlot,
    colorId: string,
    state: MascotLookPolicyState,
): MascotLookAction {
    if (isMascotColorLocked(colorId, state)) {
        return actionForLockedColor(colorId) ?? { type: MascotLookActionType.Equip, look };
    }

    return { type: MascotLookActionType.Equip, look: { ...look, [slot]: colorId } };
}

export function chooseMascotPreset(preset: MascotPreset, state: MascotLookPolicyState): MascotLookAction {
    const lockedColorId = Object.values(preset.look).find((colorId) => isMascotColorLocked(colorId, state));
    if (lockedColorId) {
        return actionForLockedColor(lockedColorId) ?? { type: MascotLookActionType.Equip, look: preset.look };
    }

    return { type: MascotLookActionType.Equip, look: { ...preset.look }, announceLookEquipped: true };
}

export function mascotSwatchesForSlot(
    slot: MascotSlot,
    look: LookMap,
    state: MascotLookPolicyState,
): MascotSwatchModel[] {
    return [...MASCOT_PALETTE[slot]]
        .map((swatch) => ({
            ...swatch,
            locked: isMascotColorLocked(swatch.id, state),
            selected: look[slot] === swatch.id,
        }))
        .sort((a, b) => Number(a.locked) - Number(b.locked));
}

export function mascotPresetModels(look: LookMap, state: MascotLookPolicyState): MascotPresetModel[] {
    return MASCOT_PRESETS.map((preset) => ({
        preset,
        locked: Object.values(preset.look).some((colorId) => isMascotColorLocked(colorId, state)),
        selected: Object.entries(preset.look).every(([slot, colorId]) => look[slot as MascotSlot] === colorId),
    }));
}
