// The Level Map — the progression spine. Finite and data-driven so future updates
// append entries + ship the cosmetic; because level/unlockedRewards are pure
// functions of monotonic lifetimeXp, extending the map is additive and retroactive
// (no migration). Earned-theme TOKENS live in src/theme/themes/; nodes only
// reference their reward id.

/** One step on the map. `xp` is the cumulative lifetime XP required to reach it. */
export interface LevelNode {
    level: number;
    xp: number;
    /** Earned cosmetic unlocked at this node, if any. */
    rewardId?: string;
    /** Placeholder for a cosmetic shipped in a later update (granted retroactively). */
    reserved?: boolean;
}

export const LEVEL_MAP: readonly LevelNode[] = [
    { level: 1, xp: 0 },
    { level: 2, xp: 150 },
    { level: 3, xp: 400 },
    { level: 4, xp: 750 },
    { level: 5, xp: 1200 },
    { level: 6, xp: 1800 },
    { level: 7, xp: 2600 },
    { level: 8, xp: 3600 },
    { level: 9, xp: 4900 },
    { level: 10, xp: 6500 },
    { level: 11, xp: 8500 },
    { level: 12, xp: 11000 },
    { level: 13, xp: 14000 },
    { level: 14, xp: 17500 },
    { level: 15, xp: 22000, rewardId: 'theme-champion' },
    { level: 16, xp: 27500 },
    { level: 17, xp: 34000 },
    { level: 18, xp: 41500 },
    { level: 19, xp: 50500 },
    { level: 20, xp: 61000 },
    { level: 21, xp: 73000 },
    { level: 22, xp: 87000 },
    { level: 23, xp: 103000 },
    { level: 24, xp: 121500 },
    { level: 25, xp: 143000 },
    { level: 26, xp: 168000 },
    { level: 27, xp: 197000 },
    { level: 28, xp: 230500 },
    { level: 29, xp: 269000 },
    { level: 30, xp: 313000, rewardId: 'theme-legend' },
];

/** Current level: the highest node whose threshold lifetimeXp has reached. */
export function level(lifetimeXp: number): number {
    let current = LEVEL_MAP[0].level;
    for (const node of LEVEL_MAP) {
        if (lifetimeXp >= node.xp) current = node.level;
        else break;
    }
    return current;
}

/** Cumulative XP threshold for a given level. */
export function xpForLevel(targetLevel: number): number {
    return LEVEL_MAP.find((n) => n.level === targetLevel)?.xp ?? 0;
}

/** Every earned-cosmetic id whose node has been reached. Derived, so retroactive. */
export function unlockedRewards(lifetimeXp: number): Set<string> {
    const ids = new Set<string>();
    for (const node of LEVEL_MAP) {
        if (node.rewardId && lifetimeXp >= node.xp) ids.add(node.rewardId);
    }
    return ids;
}

/** Fill within the current level band — for the Home level chip and XP bar. */
export function levelProgress(lifetimeXp: number): {
    level: number;
    intoLevel: number;
    span: number;
    nextLevelXp: number | null;
} {
    const current = level(lifetimeXp);
    const currentXp = xpForLevel(current);
    const next = LEVEL_MAP.find((n) => n.level === current + 1);
    if (!next) {
        return { level: current, intoLevel: 0, span: 0, nextLevelXp: null };
    }
    return {
        level: current,
        intoLevel: lifetimeXp - currentXp,
        span: next.xp - currentXp,
        nextLevelXp: next.xp,
    };
}
