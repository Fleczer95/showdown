#!/usr/bin/env node

import { DROP_DIFFICULTY_RATIO, DROP_PACK_TOTAL, getDropDifficultyTargets } from './drop_ratio.mjs';

// Deterministic sizing planner for a Showdown premium pack.
//
// Emits the exact per-slot target counts + id ranges for a pack so authoring is
// consistent across runs. The sizing rule is fixed: total = 20 x full-run size.
//   - ladder: 300, FRONT-LOADED across the 15 rungs (5 pools of 3 rungs).
//   - drop:   180, flat storage with a 77/65/38 easy/medium/hard inventory.
//   - wheel:  60,  flat pool.
//
// Usage:
//   node pack_plan.mjs --game <ladder|drop|wheel> --slug <kebab-slug>
//
// Front-load curve (per rung): P1=30, P2=24, P3=20, P4=15, P5=11.
//   Pool 1 = rungs 1-3, Pool 2 = rungs 4-6, ... Pool 5 = rungs 13-15.
//   Sum = 3*(30+24+20+15+11) = 300.
// NOTE: P4/P5 (15, 11 per rung) intentionally fall BELOW the content-audit's
// 20-per-rung floor. That floor is for FREE base content; a front-loaded premium
// pack is expected to dip below it on the hard, rarely-reached pools. The
// self-review must treat ladder "<20 per rung" warnings on rungs 10-15 as
// EXPECTED, not blocking.

const GAMES = ['ladder', 'drop', 'wheel'];
const LADDER_PER_RUNG = [30, 30, 30, 24, 24, 24, 20, 20, 20, 15, 15, 15, 11, 11, 11]; // rungs 1..15
const FLAT = { drop: DROP_PACK_TOTAL, wheel: 60 };

function parseArgs(argv) {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--game') a.game = argv[++i];
        else if (argv[i] === '--slug') a.slug = argv[++i];
        else if (argv[i] === '--help' || argv[i] === '-h') a.help = true;
    }
    return a;
}

function pad(n) {
    return String(n).padStart(3, '0');
}

function plan(game, slug) {
    if (game === 'ladder') {
        const rungs = LADDER_PER_RUNG.map((count, idx) => {
            const rung = idx + 1;
            const pool = Math.floor(idx / 3) + 1; // 1..5
            return { rung, pool, difficulty: rung, count };
        });
        const total = rungs.reduce((s, r) => s + r.count, 0);
        return {
            game,
            slug,
            total,
            idPrefix: `ladder-${slug}-`,
            idExample: `ladder-${slug}-${pad(1)} .. ladder-${slug}-${pad(total)}`,
            note: 'Each rung is its own pool of QuestionContent in RUNGS[rung-1]. difficulty MUST equal the rung number. Pools 4-5 are intentionally lean.',
            rungs,
        };
    }
    const total = FLAT[game];
    const dropPlan =
        game === 'drop'
            ? {
                  difficultyRatio: DROP_DIFFICULTY_RATIO,
                  difficultyTargets: getDropDifficultyTargets(total),
                  roundOrder: ['easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard'],
              }
            : {};
    return {
        game,
        slug,
        total,
        idPrefix: `${game}-${slug}-`,
        idExample: `${game}-${slug}-${pad(1)} .. ${game}-${slug}-${pad(total)}`,
        ...dropPlan,
        note:
            game === 'drop'
                ? 'Flat storage, but every card needs a classifier-authored difficulty. Required inventory: 77 easy / 65 medium / 38 hard (largest-remainder apportionment of 20:17:10). Author or replace content to hit the targets; never force a false label.'
                : 'Flat pool of PuzzleContent. No difficulty field. Phrases UPPERCASE, public-domain/original only.',
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.game) {
        console.log('Usage: node pack_plan.mjs --game <ladder|drop|wheel> --slug <kebab-slug>');
        return args.help ? 0 : 1;
    }
    if (!GAMES.includes(args.game)) {
        console.error(`Invalid --game "${args.game}". One of: ${GAMES.join(', ')}`);
        return 1;
    }
    const slug = args.slug || 'pack';
    console.log(JSON.stringify(plan(args.game, slug), null, 2));
    return 0;
}

process.exit(main());
