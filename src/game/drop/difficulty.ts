import { FREE_DROP_DIFFICULTY_IDS } from './difficulty/free';
import { OUR_CHANGING_PLANET_DROP_DIFFICULTY_IDS } from './difficulty/ourChangingPlanet';
import { WORLD_GEOGRAPHY_DROP_DIFFICULTY_IDS } from './difficulty/worldGeography';

export const DROP_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type DropDifficulty = (typeof DROP_DIFFICULTIES)[number];

/** Three rounds at each level, ordered from approachable to specialist. */
export const DROP_ROUND_DIFFICULTIES = [
    'easy',
    'easy',
    'easy',
    'medium',
    'medium',
    'medium',
    'hard',
    'hard',
    'hard',
] as const satisfies readonly DropDifficulty[];

export const DROP_DIFFICULTY_ASSIGNMENTS = {
    free: FREE_DROP_DIFFICULTY_IDS,
    worldGeography: WORLD_GEOGRAPHY_DROP_DIFFICULTY_IDS,
    ourChangingPlanet: OUR_CHANGING_PLANET_DROP_DIFFICULTY_IDS,
} as const;

const difficultyById = new Map<string, DropDifficulty>();

for (const groups of Object.values(DROP_DIFFICULTY_ASSIGNMENTS)) {
    for (const difficulty of DROP_DIFFICULTIES) {
        for (const id of groups[difficulty]) {
            if (difficultyById.has(id)) {
                throw new Error(`Duplicate The Drop difficulty classification for "${id}".`);
            }
            difficultyById.set(id, difficulty);
        }
    }
}

/**
 * Resolve the classifier-authored level for a canonical question id.
 * Missing metadata is a content-build error: an unrated question must never
 * silently fall into a default pool.
 */
export function getDropQuestionDifficulty(id: string): DropDifficulty {
    const difficulty = difficultyById.get(id);
    if (!difficulty) {
        throw new Error(`Missing The Drop difficulty classification for "${id}".`);
    }
    return difficulty;
}
