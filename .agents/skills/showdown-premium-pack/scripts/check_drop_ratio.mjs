#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DROP_DIFFICULTY_RATIO, DROP_PACK_TOTAL, getDropDifficultyTargets } from './drop_ratio.mjs';

const LEVELS = Object.keys(DROP_DIFFICULTY_RATIO);

function usage() {
    console.log('Usage: node check_drop_ratio.mjs <difficulty-map-file>');
}

function idsInGroup(source, level) {
    const group = source.match(new RegExp(`\\b${level}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
    if (!group) throw new Error(`Missing "${level}" array.`);
    return [...group[1].matchAll(/['"](drop-[^'"]+)['"]/g)].map((match) => match[1]);
}

function main() {
    const file = process.argv[2];
    if (!file || file === '--help' || file === '-h') {
        usage();
        return file ? 0 : 1;
    }

    const absolutePath = resolve(file);
    const source = readFileSync(absolutePath, 'utf8');
    const groups = Object.fromEntries(LEVELS.map((level) => [level, idsInGroup(source, level)]));
    const counts = Object.fromEntries(LEVELS.map((level) => [level, groups[level].length]));
    const targets = getDropDifficultyTargets();
    const allIds = LEVELS.flatMap((level) => groups[level]);
    const duplicateIds = [...new Set(allIds.filter((id, index) => allIds.indexOf(id) !== index))];

    const errors = [];
    for (const level of LEVELS) {
        if (counts[level] !== targets[level]) {
            errors.push(`${level}: expected ${targets[level]}, found ${counts[level]}`);
        }
    }
    if (allIds.length !== DROP_PACK_TOTAL) {
        errors.push(`total: expected ${DROP_PACK_TOTAL}, found ${allIds.length}`);
    }
    if (duplicateIds.length > 0) {
        errors.push(`duplicate IDs: ${duplicateIds.join(', ')}`);
    }

    const report = {
        file: absolutePath,
        ratio: DROP_DIFFICULTY_RATIO,
        targets,
        counts,
        total: allIds.length,
        uniqueIds: new Set(allIds).size,
    };

    if (errors.length > 0) {
        console.error(JSON.stringify({ ...report, errors }, null, 2));
        return 1;
    }

    console.log(JSON.stringify({ ...report, status: 'PASS' }, null, 2));
    return 0;
}

process.exit(main());
