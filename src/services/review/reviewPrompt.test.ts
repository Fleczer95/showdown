import { crossedReviewMilestone } from './reviewPrompt';

describe('crossedReviewMilestone', () => {
    it('fires on every 5th-level milestone crossing', () => {
        expect(crossedReviewMilestone(4, 5)).toBe(true);
        expect(crossedReviewMilestone(9, 10)).toBe(true);
        expect(crossedReviewMilestone(14, 15)).toBe(true);
        expect(crossedReviewMilestone(19, 20)).toBe(true);
    });

    it('fires when a single run jumps past one or more milestones', () => {
        expect(crossedReviewMilestone(3, 11)).toBe(true); // crosses 5 and 10
        expect(crossedReviewMilestone(11, 20)).toBe(true); // crosses 15 and 20
    });

    it('does not fire on a level-up that crosses no milestone', () => {
        expect(crossedReviewMilestone(5, 6)).toBe(false);
        expect(crossedReviewMilestone(10, 11)).toBe(false);
        expect(crossedReviewMilestone(0, 4)).toBe(false);
        expect(crossedReviewMilestone(6, 9)).toBe(false);
    });
});
