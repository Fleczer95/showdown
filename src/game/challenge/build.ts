// Challenge builder — freezes a game's round into a self-contained, bilingual
// record (ADR-0003). The frozen round embeds every question's payload in all
// locales so any opponent can play regardless of which premium packs they own,
// and in their own device language.
//
// Cross-locale consistency is the crux: both players must face an identical
// board (same questions, same order, same option positions) even when playing
// in different languages. We get that for free by building the run ONCE over
// *bilingual* questions — `createDeck` / `buildRun` / `buildGame` only reorder
// and reference option elements, never read their text, so a shuffle keeps the
// en/pl halves paired — then splitting the result into per-locale payloads.

import { createDeck, type History } from '../deck';
import { RUNGS } from '../ladder/content';
import { buildRun, type LadderQuestion } from '../ladder/logic';
import type { LadderPackCard } from '../ladder/buildRuns';
import { dropQuestions, zipDropCard, type DropPackCard } from '../drop/content';
import { buildGame, type DropQuestion } from '../drop/logic';
import { getPack } from '../wheel/content';
import { TOTAL_PUZZLES, type PuzzleContent } from '../wheel/logic';
import { getOwnedPackContentBilingual } from '../../data/store/packContent';
import {
    CHALLENGE_TTL_DAYS,
    MIN_APP_VERSION,
    SCHEMA_VERSION,
    type ChallengeCreator,
    type ChallengeLocale,
    type ChallengeQuestion,
    type ChallengeRecord,
} from './types';

// --- Frozen payload shapes (what each game's play screen consumes per round) ---

/** The Ladder's frozen unit: a rung to climb — the question plus a few Skip alternates. */
export interface LadderRungPayload {
    current: LadderQuestion;
    alternates: LadderQuestion[];
}

/** The Drop's frozen unit: one single-locale question with options pre-shuffled. */
export interface DropQuestionPayload {
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
}

/** The Wheel's frozen unit is exactly its play-time puzzle. */
export type WheelPuzzlePayload = PuzzleContent;

// --- Bilingual intermediates used only while building ---

interface LocalizedString {
    en: string;
    pl: string;
}

/** A ladder question whose options are en/pl pairs, so a shuffle moves both together. */
interface BilingualLadderQuestion {
    id: string;
    prompt: LocalizedString;
    options: LocalizedString[];
    correctIndex: number;
    hint: LocalizedString;
}

interface BilingualPuzzle {
    id: string;
    phrase: LocalizedString;
    category: LocalizedString;
}

/** Skip alternates frozen per rung — enough to keep Skip useful without bloating the record. */
const LADDER_ALTERNATE_CAP = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BuildChallengeArgs {
    /** Game id, e.g. `the-ladder` / `the-drop` / `the-wheel`. */
    gameId: string;
    /** Creator's local question history, so the frozen run favours least-shown questions. */
    history: History;
    /** Packs the creator owns; their content is embedded (bilingual) as a soft upsell. */
    ownedIds: ReadonlySet<string>;
    createdBy: ChallengeCreator;
    /** App version authoring the record (diagnostics). */
    appVersion: string;
    /** Authoring language — the fallback locale when a player's isn't embedded. */
    lang: ChallengeLocale;
    rng?: () => number;
    now?: () => number;
}

/** Freeze a game's round into an immutable, self-contained challenge document. */
export function buildChallenge(args: BuildChallengeArgs): ChallengeRecord {
    const rng = args.rng ?? Math.random;
    const nowMs = (args.now ?? Date.now)();
    return {
        schemaVersion: SCHEMA_VERSION,
        minAppVersion: MIN_APP_VERSION,
        appVersion: args.appVersion,
        lang: args.lang,
        game: args.gameId,
        questions: freezeQuestions(args.gameId, args.history, args.ownedIds, rng),
        createdBy: args.createdBy,
        expiresAt: nowMs + CHALLENGE_TTL_DAYS * MS_PER_DAY,
    };
}

function freezeQuestions(
    gameId: string,
    history: History,
    ownedIds: ReadonlySet<string>,
    rng: () => number,
): ChallengeQuestion[] {
    switch (gameId) {
        case 'the-ladder':
            return freezeLadder(history, ownedIds, rng);
        case 'the-drop':
            return freezeDrop(history, ownedIds, rng);
        case 'the-wheel':
            return freezeWheel(history, ownedIds, rng);
        default:
            throw new Error(`Cannot build a challenge for unknown game "${gameId}"`);
    }
}

// --- The Ladder -------------------------------------------------------------

function localizeLadder(q: BilingualLadderQuestion, locale: ChallengeLocale): LadderQuestion {
    return {
        id: q.id,
        prompt: q.prompt[locale],
        options: q.options.map((o) => o[locale]),
        correctIndex: q.correctIndex,
        hint: q.hint[locale],
    };
}

/** Combine an owned ladder pack's parallel en/pl cards into one bilingual question. */
function zipLadderCard(en: LadderPackCard, pl: LadderPackCard): BilingualLadderQuestion & { difficulty: number } {
    return {
        id: en.id,
        difficulty: en.difficulty,
        correctIndex: en.correctIndex,
        prompt: { en: en.prompt, pl: pl.prompt },
        options: en.options.map((o, i) => ({ en: o, pl: pl.options[i] })),
        hint: { en: en.hint ?? '', pl: pl.hint ?? '' },
    };
}

/**
 * Bilingual mirror of `buildLocalizedRungs`: turn the bilingual bank (plus owned
 * pack cards slotted by difficulty) into the 5-pools-of-3 rung structure that
 * `buildRun` samples from.
 */
function buildBilingualRungs(
    ownedCards: (BilingualLadderQuestion & { difficulty: number })[],
): BilingualLadderQuestion[][] {
    const rawRungs: BilingualLadderQuestion[][] = RUNGS.map((rung) =>
        rung.map((q) => ({
            id: q.id,
            prompt: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            hint: q.hint,
        })),
    );
    for (const card of ownedCards) {
        const rungIndex = card.difficulty - 1;
        if (rungIndex >= 0 && rungIndex < rawRungs.length) {
            rawRungs[rungIndex].push({
                id: card.id,
                prompt: card.prompt,
                options: card.options,
                correctIndex: card.correctIndex,
                hint: card.hint,
            });
        }
    }
    const pooled: BilingualLadderQuestion[][] = [];
    for (let i = 0; i < 5; i++) {
        const start = i * 3;
        const combined = [...rawRungs[start], ...rawRungs[start + 1], ...rawRungs[start + 2]];
        pooled.push(combined, combined, combined);
    }
    return pooled;
}

function freezeLadder(
    history: History,
    ownedIds: ReadonlySet<string>,
    rng: () => number,
): ChallengeQuestion<LadderRungPayload>[] {
    const ownedCards = getOwnedPackContentBilingual<LadderPackCard, BilingualLadderQuestion & { difficulty: number }>(
        'the-ladder',
        ownedIds,
        zipLadderCard,
    );
    const pools = buildBilingualRungs(ownedCards);
    // buildRun only reorders/references option *elements*, never reads their text,
    // so it runs unchanged on bilingual questions and keeps en/pl paired.
    const run = buildRun(pools as unknown as LadderQuestion[][], history, rng);
    return run.rungs.map((rung) => {
        const current = rung.current as unknown as BilingualLadderQuestion;
        const alternates = (rung.alternates as unknown as BilingualLadderQuestion[]).slice(0, LADDER_ALTERNATE_CAP);
        return {
            id: current.id,
            byLocale: {
                en: {
                    current: localizeLadder(current, 'en'),
                    alternates: alternates.map((a) => localizeLadder(a, 'en')),
                },
                pl: {
                    current: localizeLadder(current, 'pl'),
                    alternates: alternates.map((a) => localizeLadder(a, 'pl')),
                },
            },
        };
    });
}

// --- The Drop ---------------------------------------------------------------

function freezeDrop(
    history: History,
    ownedIds: ReadonlySet<string>,
    rng: () => number,
): ChallengeQuestion<DropQuestionPayload>[] {
    const pool: DropQuestion[] = [
        ...dropQuestions,
        ...getOwnedPackContentBilingual<DropPackCard, DropQuestion>('the-drop', ownedIds, zipDropCard),
    ];
    const state = buildGame(pool, history, rng);
    return state.questions.map((q) => ({
        id: q.id,
        byLocale: {
            en: { id: q.id, prompt: q.prompt.en, options: q.options.map((o) => o.en), correctIndex: q.correctIndex },
            pl: { id: q.id, prompt: q.prompt.pl, options: q.options.map((o) => o.pl), correctIndex: q.correctIndex },
        },
    }));
}

// --- The Wheel --------------------------------------------------------------

/** Combine an owned wheel pack's parallel en/pl puzzles into one bilingual puzzle. */
function zipPuzzle(en: PuzzleContent, pl: PuzzleContent): BilingualPuzzle {
    return {
        id: en.id,
        phrase: { en: en.phrase, pl: pl.phrase },
        category: { en: en.category, pl: pl.category },
    };
}

function freezeWheel(
    history: History,
    ownedIds: ReadonlySet<string>,
    rng: () => number,
): ChallengeQuestion<WheelPuzzlePayload>[] {
    const pool: BilingualPuzzle[] = [
        ...getPack('all').puzzles,
        ...getOwnedPackContentBilingual<PuzzleContent, BilingualPuzzle>('the-wheel', ownedIds, zipPuzzle),
    ];
    const picked = createDeck(pool, history, rng).slice(0, TOTAL_PUZZLES);
    return picked.map((p) => ({
        id: p.id,
        byLocale: {
            en: { id: p.id, phrase: p.phrase.en, category: p.category.en },
            pl: { id: p.id, phrase: p.phrase.pl, category: p.category.pl },
        },
    }));
}
