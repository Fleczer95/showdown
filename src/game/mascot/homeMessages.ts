import { createMMKV } from 'react-native-mmkv';

export type HomeMascotMessageId = 'welcome' | 'streak-3' | 'streak-7' | 'streak-30' | 'offline-limit';
export type HomeMascotMessageAction = 'store' | 'progress';

export interface HomeMascotMessage {
    id: HomeMascotMessageId;
    textKey: string;
    action?: HomeMascotMessageAction;
}

export interface HomeMascotMessageState {
    streak: number;
    offlineRunsLeft: number;
    canUpsell: boolean;
}

export interface HomeMascotMessageMemory {
    hasSeen: (id: HomeMascotMessageId) => boolean;
    markSeen: (id: HomeMascotMessageId) => void;
}

export interface HomeMascotMessageOptions {
    includeSeen?: boolean;
}

const store = createMMKV({ id: 'showdown-home-mascot' });
const SEEN_KEY = 'seenMessageIds';
const STREAK_MILESTONES = [30, 7, 3] as const;

function readSeen(): HomeMascotMessageId[] {
    const raw = store.getString(SEEN_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as HomeMascotMessageId[];
    } catch {
        return [];
    }
}

export const homeMascotMessageMemory: HomeMascotMessageMemory = {
    hasSeen: (id) => readSeen().includes(id),
    markSeen: (id) => {
        const seen = new Set(readSeen());
        seen.add(id);
        store.set(SEEN_KEY, JSON.stringify([...seen]));
    },
};

export function selectHomeMascotMessage(
    state: HomeMascotMessageState,
    memory: HomeMascotMessageMemory = homeMascotMessageMemory,
    options: HomeMascotMessageOptions = {},
): HomeMascotMessage | null {
    const canUse = (id: HomeMascotMessageId) => options.includeSeen || !memory.hasSeen(id);

    if (state.offlineRunsLeft === 0 && state.canUpsell && canUse('offline-limit')) {
        return { id: 'offline-limit', textKey: 'screen.home.mascotCloud.offlineLimit', action: 'store' };
    }

    for (const milestone of STREAK_MILESTONES) {
        const id = `streak-${milestone}` as HomeMascotMessageId;
        if (state.streak >= milestone && canUse(id)) {
            return { id, textKey: `screen.home.mascotCloud.streak${milestone}`, action: 'progress' };
        }
    }

    if (canUse('welcome')) {
        return { id: 'welcome', textKey: 'screen.home.mascotCloud.welcome' };
    }

    return null;
}
