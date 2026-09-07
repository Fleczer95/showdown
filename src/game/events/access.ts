import { useMemo } from 'react';
import { useStore } from '../../hooks/store/useStore';
import { useProgression } from '../../hooks/useProgression';
import { getEntryForId } from '../../data/store/catalog';
import { PROGRESSION_THEMES } from '../progression/themes';
import { PROGRESSION_MASCOT_COLORS } from '../progression/mascotColors';

/** Access union only — never pass this to purchases or paid-item allowance counting. */
export function accessibleItemIds(purchased: readonly string[], earned: readonly string[]): string[] {
    return [...new Set([...purchased, ...earned])];
}
export function useContentAccess(): string[] {
    const { purchasedItemIds } = useStore();
    const { stats } = useProgression();
    return useMemo(
        () => accessibleItemIds(purchasedItemIds, stats.earnedRewardIds ?? []),
        [purchasedItemIds, stats.earnedRewardIds],
    );
}
export function eventRewardTitleKey(id: string): string | undefined {
    return (
        PROGRESSION_THEMES.find((r) => r.id === id)?.titleKey ??
        PROGRESSION_MASCOT_COLORS.find((r) => r.id === id)?.titleKey ??
        getEntryForId(id)?.presentation.titleKey
    );
}
