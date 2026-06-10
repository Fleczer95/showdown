// Streak derivation — pure functions over the set of distinct local dates played.
// A "day" is the device's local calendar date (YYYY-MM-DD); no anti-tamper.

/** Days since the epoch for a YYYY-MM-DD string (UTC-anchored, so DST-safe). */
function dayNumber(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Longest run of consecutive calendar days in the set. Order/duplicate agnostic. */
export function longestStreak(dates: readonly string[]): number {
    if (dates.length === 0) return 0;
    const days = [...new Set(dates)].map(dayNumber).sort((a, b) => a - b);
    let best = 1;
    let run = 1;
    for (let i = 1; i < days.length; i++) {
        if (days[i] === days[i - 1] + 1) run += 1;
        else run = 1;
        if (run > best) best = run;
    }
    return best;
}

/**
 * Consecutive days up to `today`. Counts the run ending today; if today hasn't
 * been played yet but yesterday was, the still-alive run ending yesterday. 0 once
 * the streak has lapsed (neither today nor yesterday played).
 */
export function currentStreak(dates: readonly string[], today: string): number {
    const days = new Set(dates.map(dayNumber));
    const todayNum = dayNumber(today);

    let anchor: number;
    if (days.has(todayNum)) anchor = todayNum;
    else if (days.has(todayNum - 1)) anchor = todayNum - 1;
    else return 0;

    let count = 0;
    while (days.has(anchor)) {
        count += 1;
        anchor -= 1;
    }
    return count;
}
