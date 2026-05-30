import { tabletProgress, typeScaleFactor, spaceScaleFactor, iconScaleFactor } from './scale';

// Reference widths the curve is anchored to (mirrors scale.ts internals).
const PHONE_BASE = 380;
const TABLET_FULL = 840;
const COMPACT_FULL = 320;

describe('responsive scale', () => {
    describe('tabletProgress', () => {
        it('is 0 at and below the phone baseline', () => {
            expect(tabletProgress(PHONE_BASE)).toBe(0);
            expect(tabletProgress(COMPACT_FULL)).toBe(0);
        });

        it('is 1 at and above the tablet width', () => {
            expect(tabletProgress(TABLET_FULL)).toBe(1);
            expect(tabletProgress(1200)).toBe(1);
        });

        it('grows linearly between baseline and tablet width', () => {
            expect(tabletProgress((PHONE_BASE + TABLET_FULL) / 2)).toBeCloseTo(0.5, 5);
        });
    });

    // Each factor is anchored: floor (compact) → 1 (phone) → ceiling (tablet).
    describe.each([
        ['typeScaleFactor', typeScaleFactor, 0.85, 1.5],
        ['spaceScaleFactor', spaceScaleFactor, 0.9, 1.3],
        ['iconScaleFactor', iconScaleFactor, 1.0, 1.45],
    ] as const)('%s', (_name, fn, floor, ceiling) => {
        it('equals 1 at the phone baseline', () => {
            expect(fn(PHONE_BASE)).toBeCloseTo(1, 5);
        });

        it('reaches its ceiling at the tablet width', () => {
            expect(fn(TABLET_FULL)).toBeCloseTo(ceiling, 5);
        });

        it('reaches its floor at the compact width', () => {
            expect(fn(COMPACT_FULL)).toBeCloseTo(floor, 5);
        });

        it('clamps beyond the ceiling and floor', () => {
            expect(fn(2000)).toBeCloseTo(ceiling, 5);
            expect(fn(100)).toBeCloseTo(floor, 5);
        });

        it('is continuous across the baseline (no jump at the breakpoint)', () => {
            const justBelow = fn(PHONE_BASE - 1);
            const justAbove = fn(PHONE_BASE + 1);
            expect(Math.abs(justAbove - justBelow)).toBeLessThan(0.01);
        });

        it('is monotonically increasing with screen size', () => {
            expect(fn(COMPACT_FULL)).toBeLessThanOrEqual(fn(PHONE_BASE));
            expect(fn(PHONE_BASE)).toBeLessThanOrEqual(fn(TABLET_FULL));
        });
    });

    // Locks in the exact discrete values the old breakpoint-based resolver used,
    // at the representative widths resolveTheme falls back to (320/380/840).
    describe('backward compatibility with discrete factors', () => {
        it('matches prior typography factors (0.85 / 1 / 1.5)', () => {
            expect(typeScaleFactor(320)).toBeCloseTo(0.85, 5);
            expect(typeScaleFactor(380)).toBeCloseTo(1, 5);
            expect(typeScaleFactor(840)).toBeCloseTo(1.5, 5);
        });

        it('matches prior spacing factors (0.9 / 1 / 1.3)', () => {
            expect(spaceScaleFactor(320)).toBeCloseTo(0.9, 5);
            expect(spaceScaleFactor(380)).toBeCloseTo(1, 5);
            expect(spaceScaleFactor(840)).toBeCloseTo(1.3, 5);
        });
    });
});
