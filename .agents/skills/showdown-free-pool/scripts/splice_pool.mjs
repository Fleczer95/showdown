#!/usr/bin/env node
// Splice authored questions into the free-pool content.ts banks.
//
// Usage: node splice_pool.mjs <content-module.mjs>
//
// The module must default-export (or named-export) any of:
//   ladder: 15 arrays (one per rung, index 0 = rung 1) of
//           { id, en, pl, opts: [[en,pl] x4], correctIndex, hintEn, hintPl }
//   drop:   flat array of { id, en, pl, opts: [[en,pl] x4], correctIndex }
//   wheel:  flat array of { id, en, pl, catEn, catPl }
//
// Hard-fails on an apostrophe rather than writing content that would silently
// corrupt the audit engine's EN/PL parity regex.
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const mod = process.argv[2];
if (!mod) { console.error('usage: node splice_pool.mjs <content-module.mjs>'); process.exit(1); }

const m = await import(path.resolve(mod));
const src = m.default ?? m;
const { ladder, drop, wheel } = src;

const q = (s, where) => {
    if (typeof s !== 'string') throw new Error(`Not a string in ${where}: ${s}`);
    if (s.includes("'")) throw new Error(`APOSTROPHE in ${where} -> "${s}". Rephrase it; an escaped apostrophe breaks the audit parity regex.`);
    return s;
};

let summary = [];

// ---------- Ladder: insert into each rung array, before its closing bracket ----------
if (ladder) {
    if (ladder.length !== 15) throw new Error(`ladder must have 15 rung arrays, got ${ladder.length}`);
    const file = path.join(ROOT, 'src/game/ladder/content.ts');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const closers = [];
    lines.forEach((l, i) => { if (l === '    ],') closers.push(i); });
    if (closers.length !== 15) throw new Error(`expected 15 rung closers in content.ts, found ${closers.length}`);

    const render = (c) => {
        if (c.difficulty !== undefined) throw new Error(`${c.id}: free ladder questions must NOT carry a difficulty field (rung = array position)`);
        if (c.opts.length !== 4) throw new Error(`${c.id}: need exactly 4 options`);
        if (!(c.correctIndex >= 0 && c.correctIndex <= 3)) throw new Error(`${c.id}: correctIndex must be 0..3`);
        const o = c.opts.map(([en, pl]) => `{ en: '${q(en, c.id)}', pl: '${q(pl, c.id)}' }`).join(', ');
        return `        { id: '${c.id}', question: { en: '${q(c.en, c.id)}', pl: '${q(c.pl, c.id)}' }, options: [${o}], correctIndex: ${c.correctIndex}, hint: { en: '${q(c.hintEn, c.id)}', pl: '${q(c.hintPl, c.id)}' } },`;
    };
    // Bottom-up so earlier line indices stay valid.
    for (let r = 14; r >= 0; r--) {
        const rows = (ladder[r] ?? []).map(render);
        if (rows.length) lines.splice(closers[r], 0, ...rows);
    }
    fs.writeFileSync(file, lines.join('\n'));
    summary.push(`ladder +${ladder.flat().length}`);
}

// ---------- Drop: append to the flat array ----------
if (drop?.length) {
    const file = path.join(ROOT, 'src/game/drop/content.ts');
    let s = fs.readFileSync(file, 'utf8');
    const render = (c) => {
        if (c.opts.length !== 4) throw new Error(`${c.id}: need exactly 4 options`);
        const o = c.opts.map(([en, pl]) => `{ en: '${q(en, c.id)}', pl: '${q(pl, c.id)}' }`).join(', ');
        return `    { id: '${c.id}', prompt: { en: '${q(c.en, c.id)}', pl: '${q(c.pl, c.id)}' }, options: [${o}], correctIndex: ${c.correctIndex} },`;
    };
    const at = s.lastIndexOf('\n];\n');
    if (at === -1) throw new Error('drop: end-of-array anchor not found');
    s = s.slice(0, at) + '\n' + drop.map(render).join('\n') + s.slice(at);
    fs.writeFileSync(file, s);
    summary.push(`drop +${drop.length}`);
}

// ---------- Wheel: append to PACKS.all.puzzles ----------
if (wheel?.length) {
    const file = path.join(ROOT, 'src/game/wheel/content.ts');
    let s = fs.readFileSync(file, 'utf8');
    const render = (c) =>
        `        { id: '${c.id}', phrase: { en: '${q(c.en, c.id)}', pl: '${q(c.pl, c.id)}' }, category: { en: '${q(c.catEn, c.id)}', pl: '${q(c.catPl, c.id)}' } },`;
    const at = s.lastIndexOf('\n    ],\n};');
    if (at === -1) throw new Error('wheel: end-of-puzzles anchor not found');
    s = s.slice(0, at) + '\n' + wheel.map(render).join('\n') + s.slice(at);
    fs.writeFileSync(file, s);
    summary.push(`wheel +${wheel.length}`);
}

console.log(`Spliced: ${summary.join(', ')}`);
console.log(`
NOW VERIFY (all three must be green):
  node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs src/game/ladder/content.ts src/game/drop/content.ts src/game/wheel/content.ts
  npx tsx scripts/validate-content.mjs
  npx tsc --noEmit`);
