export type Breakpoint = 'compact' | 'regular' | 'expanded';

const COMPACT_THRESHOLD = 380;
const EXPANDED_THRESHOLD = 768;

export function getBreakpoint(width: number, height: number): Breakpoint {
    const shortest = Math.min(width, height);
    if (shortest < COMPACT_THRESHOLD) return 'compact';
    if (shortest < EXPANDED_THRESHOLD) return 'regular';
    return 'expanded';
}
