export const DROP_PACK_TOTAL = 180;

export const DROP_DIFFICULTY_RATIO = Object.freeze({
    easy: 20,
    medium: 17,
    hard: 10,
});

/**
 * Convert ratio weights into whole-card targets with deterministic
 * largest-remainder apportionment. Ties keep easy -> medium -> hard order.
 */
export function apportionByLargestRemainder(total, weights) {
    if (!Number.isInteger(total) || total <= 0) {
        throw new Error(`Total must be a positive integer; received ${total}.`);
    }

    const entries = Object.entries(weights);
    const weightTotal = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (entries.length === 0 || weightTotal <= 0 || entries.some(([, weight]) => weight <= 0)) {
        throw new Error('Ratio weights must be non-empty positive numbers.');
    }

    const rows = entries.map(([name, weight], index) => {
        const ideal = (total * weight) / weightTotal;
        const count = Math.floor(ideal);
        return { name, index, count, remainder: ideal - count };
    });

    let remaining = total - rows.reduce((sum, row) => sum + row.count, 0);
    const allocationOrder = [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let i = 0; i < remaining; i++) allocationOrder[i].count += 1;

    return Object.fromEntries([...rows].sort((a, b) => a.index - b.index).map(({ name, count }) => [name, count]));
}

export function getDropDifficultyTargets(total = DROP_PACK_TOTAL) {
    return apportionByLargestRemainder(total, DROP_DIFFICULTY_RATIO);
}
