#!/usr/bin/env node

// AI Content Pipeline — Bilingual Pack generator for ShowDown.
//
// Produces bilingual (English + Polish) content packs for the four ShowDown
// game types (ladder, grid, poll, wheel) as JSON under assets/packs/<type>/<slug>.json.
//
// Generation is templated/deterministic offline (no network calls). A single,
// clearly-marked extension point (`generateItems`) is where a real LLM call slots in.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const GAME_TYPES = ['ladder', 'grid', 'poll', 'wheel'];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--help' || token === '-h') {
            args.help = true;
        } else if (token === '--selftest') {
            args.selftest = true;
        } else if (token === '--validate') {
            args.validate = argv[++i];
        } else if (token === '--type') {
            args.type = argv[++i];
        } else if (token === '--topic') {
            args.topic = argv[++i];
        } else if (token === '--slug') {
            args.slug = argv[++i];
        } else if (token === '--out') {
            args.out = argv[++i];
        } else if (token === '--count') {
            args.count = parseInt(argv[++i], 10);
        } else {
            args._unknown = args._unknown || [];
            args._unknown.push(token);
        }
    }
    return args;
}

function usage() {
    return `ShowDown — Bilingual Pack generator

Usage:
  node scripts/generate-packs.mjs --type <ladder|grid|poll|wheel> --topic "<Topic>" [options]
  node scripts/generate-packs.mjs --validate <file.json>
  node scripts/generate-packs.mjs --selftest
  node scripts/generate-packs.mjs --help

Generate options:
  --type <type>    One of: ${GAME_TYPES.join(', ')}
  --topic "<text>" Topic to build the pack around (required for generation)
  --slug <slug>    Output slug (defaults to kebab-cased topic)
  --out <dir>      Output base directory (defaults to assets/packs)
  --count <n>      Number of items to generate (ignored for ladder, which is fixed at 15)

Modes:
  --validate <file.json>  Validate an existing pack; exit 0 if valid, 1 otherwise.
  --selftest              Generate + validate one pack of each type in a temp dir.
  --help                  Show this message.
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kebabCase(text) {
    return String(text)
        .toLowerCase()
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'pack';
}

// Fixed difficulty count for the ladder game type.
const LADDER_QUESTIONS = 15;

// ---------------------------------------------------------------------------
// EXTENSION POINT: replace this templated generator with a real LLM call
// (e.g. Claude API). Keep the return shape identical.
//
// `generateItems(type, topic, count, locale)` returns an array of monolingual
// items (plain strings / numbers, NO bilingual {en,pl} wrappers) for a single
// `locale` ('en' | 'pl'). The caller invokes it once per locale and zips the
// two monolingual results into the bilingual pack shape — so EN/PL parity is
// guaranteed by construction (identical structure, identical count).
//
// To wire up a real model: make this function `await` a model call that, given
// `type`, `topic`, `count` and `locale`, returns the SAME array shape below.
// Nothing else in this file needs to change.
// ---------------------------------------------------------------------------
async function generateItems(type, topic, count, locale) {
    // Locale-specific templated text. Polish strings are deliberately obviously Polish.
    const t = (en, pl) => (locale === 'pl' ? pl : en);

    if (type === 'ladder') {
        const items = [];
        for (let i = 1; i <= LADDER_QUESTIONS; i++) {
            items.push({
                prompt: t(
                    `Sample ${topic} question ${i}`,
                    `Przykładowe pytanie ${i} o temacie ${topic}`,
                ),
                options: [
                    t(`Answer A for ${topic} #${i}`, `Odpowiedź A dla ${topic} #${i}`),
                    t(`Answer B for ${topic} #${i}`, `Odpowiedź B dla ${topic} #${i}`),
                    t(`Answer C for ${topic} #${i}`, `Odpowiedź C dla ${topic} #${i}`),
                    t(`Answer D for ${topic} #${i}`, `Odpowiedź D dla ${topic} #${i}`),
                ],
                // Deterministic but varied correct answer.
                correctIndex: i % 4,
                difficulty: i, // 1..15
            });
        }
        return items;
    }

    if (type === 'grid') {
        // count = number of categories (default 5). Each category has 5 clues.
        const categories = [];
        const cluesPerCategory = 5;
        for (let c = 1; c <= count; c++) {
            const clues = [];
            for (let r = 1; r <= cluesPerCategory; r++) {
                clues.push({
                    value: r * 100,
                    clue: t(
                        `Sample ${topic} clue ${c}-${r}`,
                        `Przykładowa wskazówka ${c}-${r} o temacie ${topic}`,
                    ),
                    answer: t(
                        `Sample ${topic} answer ${c}-${r}`,
                        `Przykładowa odpowiedź ${c}-${r} o temacie ${topic}`,
                    ),
                });
            }
            categories.push({
                name: t(
                    `${topic} category ${c}`,
                    `${topic} kategoria ${c}`,
                ),
                clues,
            });
        }
        return categories;
    }

    if (type === 'poll') {
        // count = number of surveys (default 5). Each survey has 4 answers summing to 100.
        const surveys = [];
        for (let s = 1; s <= count; s++) {
            surveys.push({
                question: t(
                    `Sample ${topic} survey ${s}`,
                    `Przykładowa ankieta ${s} o temacie ${topic}`,
                ),
                answers: [
                    { text: t(`Top answer ${s}`, `Najczęstsza odpowiedź ${s}`), count: 40 },
                    { text: t(`Second answer ${s}`, `Druga odpowiedź ${s}`), count: 30 },
                    { text: t(`Third answer ${s}`, `Trzecia odpowiedź ${s}`), count: 20 },
                    { text: t(`Fourth answer ${s}`, `Czwarta odpowiedź ${s}`), count: 10 },
                ],
            });
        }
        return surveys;
    }

    if (type === 'wheel') {
        // count = number of puzzles (default 8).
        const puzzles = [];
        for (let p = 1; p <= count; p++) {
            puzzles.push({
                phrase: t(
                    `Sample ${topic} phrase ${p}`,
                    `Przykładowe hasło ${p} o temacie ${topic}`,
                ),
                category: t(
                    `${topic} category`,
                    `${topic} kategoria`,
                ),
            });
        }
        return puzzles;
    }

    throw new Error(`Unknown game type: ${type}`);
}

// ---------------------------------------------------------------------------
// Pack assembly — zip monolingual EN + PL items into the bilingual shape.
// Parity is guaranteed by construction: same type, same topic, same count.
// ---------------------------------------------------------------------------

function bilingual(en, pl) {
    return { en, pl };
}

const DEFAULT_COUNTS = { ladder: LADDER_QUESTIONS, grid: 5, poll: 5, wheel: 8 };

async function generatePack(type, topic, slug, count) {
    if (!GAME_TYPES.includes(type)) {
        throw new Error(`Invalid --type "${type}". Must be one of: ${GAME_TYPES.join(', ')}`);
    }

    const effectiveCount = type === 'ladder'
        ? LADDER_QUESTIONS
        : (Number.isInteger(count) && count > 0 ? count : DEFAULT_COUNTS[type]);

    const enItems = await generateItems(type, topic, effectiveCount, 'en');
    const plItems = await generateItems(type, topic, effectiveCount, 'pl');

    const pack = {
        type,
        slug,
        topic: bilingual(`${topic}`, `${topic}`),
    };

    if (type === 'ladder') {
        pack.questions = enItems.map((en, i) => {
            const pl = plItems[i];
            return {
                prompt: bilingual(en.prompt, pl.prompt),
                options: en.options.map((opt, j) => bilingual(opt, pl.options[j])),
                correctIndex: en.correctIndex,
                difficulty: en.difficulty,
            };
        });
    } else if (type === 'grid') {
        pack.categories = enItems.map((en, i) => {
            const pl = plItems[i];
            return {
                name: bilingual(en.name, pl.name),
                clues: en.clues.map((clue, j) => ({
                    value: clue.value,
                    clue: bilingual(clue.clue, pl.clues[j].clue),
                    answer: bilingual(clue.answer, pl.clues[j].answer),
                })),
            };
        });
    } else if (type === 'poll') {
        pack.surveys = enItems.map((en, i) => {
            const pl = plItems[i];
            return {
                question: bilingual(en.question, pl.question),
                answers: en.answers.map((a, j) => ({
                    text: bilingual(a.text, pl.answers[j].text),
                    count: a.count,
                })),
            };
        });
    } else if (type === 'wheel') {
        pack.puzzles = enItems.map((en, i) => {
            const pl = plItems[i];
            return {
                phrase: bilingual(en.phrase, pl.phrase),
                category: bilingual(en.category, pl.category),
            };
        });
    }

    return pack;
}

// ---------------------------------------------------------------------------
// Validation — shared by --validate and --selftest.
// Returns an array of error strings (empty array === valid).
// ---------------------------------------------------------------------------

function checkBilingual(value, jsonPath, errors) {
    if (value === null || typeof value !== 'object') {
        errors.push(`${jsonPath}: expected bilingual object {en, pl}, got ${typeof value}`);
        return;
    }
    for (const lang of ['en', 'pl']) {
        if (typeof value[lang] !== 'string' || value[lang].trim() === '') {
            errors.push(`${jsonPath}.${lang}: missing or empty ${lang} string`);
        }
    }
}

function validatePack(pack) {
    const errors = [];

    if (pack === null || typeof pack !== 'object') {
        return ['<root>: pack is not an object'];
    }

    if (!GAME_TYPES.includes(pack.type)) {
        errors.push(`type: must be one of ${GAME_TYPES.join(', ')}, got "${pack.type}"`);
    }
    if (typeof pack.slug !== 'string' || pack.slug.trim() === '') {
        errors.push('slug: missing or empty');
    }
    checkBilingual(pack.topic, 'topic', errors);

    if (pack.type === 'ladder') {
        if (!Array.isArray(pack.questions) || pack.questions.length === 0) {
            errors.push('questions: required non-empty array');
        } else {
            if (pack.questions.length !== LADDER_QUESTIONS) {
                errors.push(`questions: ladder must have exactly ${LADDER_QUESTIONS}, got ${pack.questions.length}`);
            }
            pack.questions.forEach((q, i) => {
                const p = `questions[${i}]`;
                checkBilingual(q.prompt, `${p}.prompt`, errors);
                if (!Array.isArray(q.options) || q.options.length !== 4) {
                    errors.push(`${p}.options: must have exactly 4 options`);
                } else {
                    q.options.forEach((opt, j) => checkBilingual(opt, `${p}.options[${j}]`, errors));
                }
                if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
                    errors.push(`${p}.correctIndex: must be an integer 0..3, got ${q.correctIndex}`);
                }
                if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 15) {
                    errors.push(`${p}.difficulty: must be an integer 1..15, got ${q.difficulty}`);
                }
            });
        }
    } else if (pack.type === 'grid') {
        if (!Array.isArray(pack.categories) || pack.categories.length === 0) {
            errors.push('categories: required non-empty array');
        } else {
            pack.categories.forEach((cat, i) => {
                const p = `categories[${i}]`;
                checkBilingual(cat.name, `${p}.name`, errors);
                if (!Array.isArray(cat.clues) || cat.clues.length === 0) {
                    errors.push(`${p}.clues: required non-empty array`);
                } else {
                    cat.clues.forEach((clue, j) => {
                        const cp = `${p}.clues[${j}]`;
                        if (typeof clue.value !== 'number') {
                            errors.push(`${cp}.value: must be a number`);
                        }
                        checkBilingual(clue.clue, `${cp}.clue`, errors);
                        checkBilingual(clue.answer, `${cp}.answer`, errors);
                    });
                }
            });
        }
    } else if (pack.type === 'poll') {
        if (!Array.isArray(pack.surveys) || pack.surveys.length === 0) {
            errors.push('surveys: required non-empty array');
        } else {
            pack.surveys.forEach((survey, i) => {
                const p = `surveys[${i}]`;
                checkBilingual(survey.question, `${p}.question`, errors);
                if (!Array.isArray(survey.answers) || survey.answers.length === 0) {
                    errors.push(`${p}.answers: required non-empty array`);
                } else {
                    let sum = 0;
                    survey.answers.forEach((a, j) => {
                        const ap = `${p}.answers[${j}]`;
                        checkBilingual(a.text, `${ap}.text`, errors);
                        if (typeof a.count !== 'number') {
                            errors.push(`${ap}.count: must be a number`);
                        } else {
                            sum += a.count;
                        }
                    });
                    if (Math.abs(sum - 100) > 5) {
                        errors.push(`${p}.answers: counts must sum to ~100 (±5), got ${sum}`);
                    }
                }
            });
        }
    } else if (pack.type === 'wheel') {
        if (!Array.isArray(pack.puzzles) || pack.puzzles.length === 0) {
            errors.push('puzzles: required non-empty array');
        } else {
            pack.puzzles.forEach((puzzle, i) => {
                const p = `puzzles[${i}]`;
                checkBilingual(puzzle.phrase, `${p}.phrase`, errors);
                checkBilingual(puzzle.category, `${p}.category`, errors);
            });
        }
    }

    return errors;
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

function writePack(pack, baseDir) {
    const dir = path.join(baseDir, pack.type);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${pack.slug}.json`);
    fs.writeFileSync(file, JSON.stringify(pack, null, 2) + '\n', 'utf8');
    return file;
}

function repoPacksDir() {
    // Resolve assets/packs relative to the repo root (parent of scripts/).
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    return path.join(scriptDir, '..', 'assets', 'packs');
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

async function runGenerate(args) {
    if (!args.type) {
        console.error('Error: --type is required for generation.\n');
        console.error(usage());
        return 1;
    }
    if (!args.topic) {
        console.error('Error: --topic is required for generation.\n');
        console.error(usage());
        return 1;
    }
    if (!GAME_TYPES.includes(args.type)) {
        console.error(`Error: invalid --type "${args.type}". Must be one of: ${GAME_TYPES.join(', ')}`);
        return 1;
    }

    const slug = args.slug ? kebabCase(args.slug) : kebabCase(args.topic);
    const baseDir = args.out || repoPacksDir();

    const pack = await generatePack(args.type, args.topic, slug, args.count);

    const errors = validatePack(pack);
    if (errors.length > 0) {
        console.error('Generated pack failed validation:');
        errors.forEach((e) => console.error(`  - ${e}`));
        return 1;
    }

    const file = writePack(pack, baseDir);
    console.log(file);
    return 0;
}

function runValidate(file) {
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
        console.error(`Cannot read file "${file}": ${err.message}`);
        return 1;
    }

    let pack;
    try {
        pack = JSON.parse(raw);
    } catch (err) {
        console.error(`Invalid JSON in "${file}": ${err.message}`);
        return 1;
    }

    const errors = validatePack(pack);
    if (errors.length > 0) {
        console.error(`INVALID: ${file}`);
        errors.forEach((e) => console.error(`  - ${e}`));
        return 1;
    }

    console.log(`VALID: ${file}`);
    return 0;
}

async function runSelftest() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showdown-packs-'));
    const results = [];
    let allPass = true;

    try {
        for (const type of GAME_TYPES) {
            let status = 'PASS';
            let detail = '';
            try {
                const pack = await generatePack(type, 'Self Test Topic', `selftest-${type}`, undefined);
                const file = writePack(pack, tmpDir);
                const errors = validatePack(JSON.parse(fs.readFileSync(file, 'utf8')));
                if (errors.length > 0) {
                    status = 'FAIL';
                    detail = errors.join('; ');
                }
            } catch (err) {
                status = 'FAIL';
                detail = err.message;
            }
            if (status === 'FAIL') {
                allPass = false;
            }
            results.push({ type, status, detail });
        }
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    console.log('Self-test results:');
    for (const r of results) {
        console.log(`  ${r.status}  ${r.type}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log(allPass ? 'PASS' : 'FAIL');
    return allPass ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help || process.argv.length <= 2) {
        console.log(usage());
        return 0;
    }
    if (args.selftest) {
        return runSelftest();
    }
    if (args.validate) {
        return runValidate(args.validate);
    }
    return runGenerate(args);
}

main()
    .then((code) => process.exit(code))
    .catch((err) => {
        console.error(`Fatal: ${err.message}`);
        process.exit(1);
    });
