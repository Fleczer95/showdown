import { profileStore } from '../../storage/appStores';
import { DEFAULT_LOOK, MASCOT_SLOTS, type LookMap } from './look';

// The mascot look this device has equipped (plan §5): a `{ slot: colorId }` map,
// NOT a single skin id, so each slot recolors independently. Stored colorIds
// are the stable strings from `look.ts` (§7.1); unknown ones resolve to the slot default at
// render time via `resolveSlotColor` (§7.3), so nothing here needs to validate them.

const KEY = 'mascotLook';

/** The equipped look, every slot present. Defaults fill any missing slot (§7.3). */
export function getEquippedLook(): LookMap {
    const raw = profileStore.getString(KEY);
    if (!raw) return { ...DEFAULT_LOOK };
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const look = { ...DEFAULT_LOOK };
        for (const slot of MASCOT_SLOTS) {
            if (typeof parsed[slot] === 'string' && parsed[slot].length > 0) look[slot] = parsed[slot];
        }
        return look;
    } catch {
        return { ...DEFAULT_LOOK };
    }
}

/** Persist the equipped look. */
export function setEquippedLook(look: LookMap): void {
    profileStore.set(KEY, JSON.stringify(look));
}
