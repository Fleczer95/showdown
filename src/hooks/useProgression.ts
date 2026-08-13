import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    loadStats,
    level,
    levelProgress,
    unlockedRewards,
    achievementsUnlocked,
    currentStreak,
    localDate,
    subscribeToStats,
    type ProgressionStats,
} from '../game/progression';

/**
 * Reads persisted progression stats and the pure derivations the UI needs.
 * Refreshes on screen focus so the Home chip / Progress screen pick up XP earned
 * since they were last shown (game-over screens drive their own celebration).
 *
 * Focus alone is not enough for a cloud restore: it resolves while Home is
 * already on screen and focused, so nothing would re-read and the player would
 * keep seeing the pre-restore zeros until they navigated somewhere and back.
 */
export function useProgression() {
    const [stats, setStats] = useState<ProgressionStats>(() => loadStats());

    useFocusEffect(useCallback(() => setStats(loadStats()), []));
    useEffect(() => subscribeToStats(setStats), []);

    return {
        stats,
        level: level(stats.lifetimeXp),
        progress: levelProgress(stats.lifetimeXp),
        unlockedRewards: unlockedRewards(stats.lifetimeXp),
        achievements: achievementsUnlocked(stats),
        streak: currentStreak(stats.datesPlayed, localDate()),
    };
}
