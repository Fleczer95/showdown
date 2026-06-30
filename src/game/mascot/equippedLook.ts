import { createMMKV } from 'react-native-mmkv';
import { DEFAULT_LOOK, type LookMap, type MascotSlot } from './look';

// The mascot look this device has equipped (plan §5): a `{ slot: colorId }` map,
// NOT a single skin id, so each slot recolors independently. Same `showdown`
// MMKV store as the rest of the app, distinct key. Stored colorIds are the stable
// strings from `look.ts` (§7.1); unknown ones resolve to the slot default at
// render time via `resolveSlotColor` (§7.3), so nothing here needs to validate them.

const store = createMMKV({ id: 'showdown' });
const KEY = 'mascotLook';

/** The equipped look, every slot present. Defaults fill any missing slot (§7.3). */
export function getEquippedLook(): LookMap {
    const raw = store.getString(KEY);
    if (!raw) return { ...DEFAULT_LOOK };
    try {
        const parsed = JSON.parse(raw) as Partial<Record<MascotSlot, string>>;
        return { ...DEFAULT_LOOK, ...parsed };
    } catch {
        return { ...DEFAULT_LOOK };
    }
}

/** Persist the equipped look. */
export function setEquippedLook(look: LookMap): void {
    store.set(KEY, JSON.stringify(look));
}
