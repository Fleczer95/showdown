#!/usr/bin/env node
// Survey the free pools before authoring: per-rung counts, lean rungs, next free id,
// and dumps of every existing EN prompt for dedup.
//
// Usage: node pool_stats.mjs [--out <dir>]
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx !== -1 ? process.argv[outIdx + 1] : ROOT;

const FILES = {
    ladder: 'src/game/ladder/content.ts',
    drop: 'src/game/drop/content.ts',
    wheel: 'src/game/wheel/content.ts',
};

const LEAN = 20; // a ladder rung below this is thin and should be topped up first

for (const [game, rel] of Object.entries(FILES)) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { console.error(`MISSING ${rel}`); continue; }
    const src = fs.readFileSync(file, 'utf8');

    const ids = [...src.matchAll(new RegExp(`id: '${game}-(\\d+)'`, 'g'))].map((m) => +m[1]);
    console.log(`\n=== ${game.toUpperCase()}  (${rel}) ===`);
    console.log(`count: ${ids.length}   max id: ${Math.max(...ids)}   -> start new ids at ${game}-${Math.max(...ids) + 1}`);

    if (game === 'ladder') {
        const rungs = src.split(/\/\/ Rung /).slice(1);
        const lean = [];
        rungs.forEach((r) => {
            const n = +r.match(/^\d+/)[0];
            const c = (r.match(/id: 'ladder-/g) || []).length;
            if (c < LEAN) lean.push(`${n} (${c})`);
            console.log(`  rung ${String(n).padStart(2)}: ${String(c).padStart(3)}${c < LEAN ? '   <-- LEAN' : ''}`);
        });
        if (lean.length) console.log(`  lean rungs (<${LEAN}), fill these first: ${lean.join(', ')}`);
    }

    // Answer-position spread. A lopsided distribution is a real exploit: "always tap B"
    // beat the whole hard+expert band on the first run of this pipeline.
    // Pass --since <id> to score only the questions you just added.
    if (game !== 'wheel') {
        // --since ladder=901,drop=201  (per game; omit to score the whole bank)
        const sinceIdx = process.argv.indexOf('--since');
        const sinceMap = Object.fromEntries(
            (sinceIdx !== -1 ? process.argv[sinceIdx + 1] : '').split(',').filter(Boolean)
                .map((p) => { const [g, v] = p.split('='); return [g, +v]; }));
        const since = sinceMap[game] ?? 0;
        const dist = [0, 0, 0, 0];
        for (const line of src.split('\n')) {
            const m = line.match(new RegExp(`id: '${game}-(\\d+)'`));
            const c = line.match(/correctIndex: (\d)/);
            if (!m || !c || +m[1] < since) continue;
            dist[+c[1]]++;
        }
        const total = dist.reduce((a, b) => a + b, 0) || 1;
        const pct = dist.map((c) => Math.round((c / total) * 100));
        const scope = since ? `ids >= ${since}` : 'whole bank';
        console.log(`  correctIndex spread (${scope}): 0:${dist[0]} 1:${dist[1]} 2:${dist[2]} 3:${dist[3]}   (${pct.join('% / ')}%)`);
        if (game === 'ladder' && Math.max(...pct) > 40) {
            console.log('  !! LOPSIDED - ladder answers must be spread across 0-3, or "always tap B" wins.');
            console.log('     Rotate the options (never just renumber correctIndex). See authoring-rules.md §1a.');
            if (!since) console.log('     NOTE: the pre-existing bank is itself skewed to index 1 - re-run with --since <your first new id> to score only your additions.');
        }
        if (game === 'drop') {
            console.log('  note: drop brackets ascending magnitudes, so indices 1+2 dominating is expected and correct.');
        }
    }

    // Dump existing EN text for dedup. Ladder/drop use question|prompt, wheel uses phrase.
    const key = game === 'wheel' ? 'phrase' : (game === 'drop' ? 'prompt' : 'question');
    const texts = [...src.matchAll(new RegExp(`${key}: \\{ en: '((?:[^'\\\\]|\\\\.)*)'`, 'g'))].map((m) => m[1]);
    const dump = path.join(OUT, `pool-existing-${game}.txt`);
    fs.writeFileSync(dump, texts.join('\n') + '\n');
    console.log(`  dumped ${texts.length} existing EN prompts -> ${dump}`);
}

console.log(`
NEXT: read the dumps before authoring. They are the dedup baseline AND the quality
baseline - the banks are already saturated with "capital of X" / "element symbol X"
(ladder) and "how many X" counting (drop). Do not add more of those.
See references/authoring-rules.md.`);
