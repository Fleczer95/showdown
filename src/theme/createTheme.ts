import type { Theme } from './contract';
import { defaultTokens } from './defaults';

/**
 * Deep merge two objects.
 * - Objects → recurse and merge
 * - Primitives → override with source
 * - Arrays → replace entirely
 * - null/undefined in source → skip (keep target)
 */
function deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) return target;
    if (typeof source !== 'object' || Array.isArray(source)) return source;

    const result = { ...target };

    for (const key of Object.keys(source)) {
        const sourceVal = source[key];
        const targetVal = target[key];

        if (
            sourceVal !== null &&
            sourceVal !== undefined &&
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal) &&
            targetVal !== null &&
            targetVal !== undefined &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal)
        ) {
            result[key] = deepMerge(targetVal, sourceVal);
        } else if (sourceVal !== undefined) {
            result[key] = sourceVal;
        }
    }

    return result;
}

/**
 * Create a theme by merging overrides with shared defaults.
 * Only `id` and `name` are truly required — everything else falls back to defaults.
 */
export function createTheme(overrides: Partial<Theme>): Theme {
    return deepMerge(defaultTokens, overrides) as Theme;
}

/** Export for testing */
export { deepMerge };
