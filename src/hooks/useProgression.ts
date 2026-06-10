import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    loadStats,
    level,
    levelProgress,
    unlockedRewards,
    achievementsUnlocked,
    currentStreak,
    localDate,
    type ProgressionStats,
} from '../game/progression';

/**
 * Reads persisted progression stats and the pure derivations the UI needs.
 * Refreshes on screen focus so the Home chip / Progress screen pick up XP earned
 * since they were last shown (game-over screens drive their own celebration).
 */
export function useProgression() {
    const [stats, setStats] = useState<ProgressionStats>(() => loadStats());

    const refresh = useCallback(() => setStats(loadStats()), []);
    useFocusEffect(refresh);

    return {
        stats,
        refresh,
        level: level(stats.lifetimeXp),
        progress: levelProgress(stats.lifetimeXp),
        unlockedRewards: unlockedRewards(stats.lifetimeXp),
        achievements: achievementsUnlocked(stats),
        streak: currentStreak(stats.datesPlayed, localDate()),
    };
}
