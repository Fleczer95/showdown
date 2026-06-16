// Challenge builder — freezes a game's round into a compact record (ADR-0003)
// that pins only the question *ids*. Every pack's content ships bundled on every
// device, so an opponent resolves the ids against its own on-device content (see
// `resolve.ts`); there's no need to embed the text. The build still runs each
// game's normal selection (`createDeck` / `buildRun` / `buildGame`) so the frozen
// run respects the creator's least-shown history — it just keeps the ids.

import { createDeck, type History } from '../deck';
import { buildRun } from '../ladder/logic';
import { buildLocalizedRungs, type LadderPackCard } from '../ladder/buildRuns';
import { dropQuestions, zipDropCard, type DropPackCard } from '../drop/content';
import { buildGame, type DropQuestion } from '../drop/logic';
import { getPack } from '../wheel/content';
import { TOTAL_PUZZLES } from '../wheel/logic';
import { getOwnedPackContent, getOwnedPackContentBilingual } from '../../data/store/packContent';
import {
    CHALLENGE_TTL_DAYS,
    type ChallengeCreator,
    type ChallengeLocale,
    type ChallengeQuestion,
    type ChallengeRecord,
} from './types';

/** Skip alternates pinned per rung — enough to keep Skip useful without bloating the record. */
const LADDER_ALTERNATE_CAP = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BuildChallengeArgs {
    /** Game id, e.g. `the-ladder` / `the-drop` / `the-wheel`. */
    gameId: string;
    /** Creator's local question history, so the frozen run favours least-shown questions. */
    history: History;
    /** Packs the creator owns; their questions join the pool the run is drawn from. */
    ownedIds: ReadonlySet<string>;
    createdBy: ChallengeCreator;
    /** Authoring language — the fallback locale when a player's isn't 'en'/'pl'. */
    lang: ChallengeLocale;
    rng?: () => number;
    now?: () => number;
}

/** Freeze a game's round into an immutable, id-only challenge document. */
export function buildChallenge(args: BuildChallengeArgs): ChallengeRecord {
    const rng = args.rng ?? Math.random;
    const nowMs = (args.now ?? Date.now)();
    return {
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

function freezeLadder(
    history: History,
    ownedIds: ReadonlySet<string>,
    rng: () => number,
): ChallengeQuestion[] {
    // Only ids are pinned, so build the run from a single locale; owned pack
    // cards merge in by difficulty exactly as solo play does.
    const ownedCards = getOwnedPackContent<LadderPackCard>('the-ladder', 'en', ownedIds);
    const pools = buildLocalizedRungs('en', ownedCards);
    const run = buildRun(pools, history, rng);
    return run.rungs.map((rung) => ({
        id: rung.current.id,
        alternates: rung.alternates.slice(0, LADDER_ALTERNATE_CAP).map((a) => a.id),
    }));
}

// --- The Drop ---------------------------------------------------------------

function freezeDrop(
    history: History,
    ownedIds: ReadonlySet<string>,
    rng: () => number,
): ChallengeQuestion[] {
    const pool: DropQuestion[] = [
        ...dropQuestions,
        ...getOwnedPackContentBilingual<DropPackCard, DropQuestion>('the-drop', ownedIds, zipDropCard),
    ];
    const state = buildGame(pool, history, rng);
    return state.questions.map((q) => ({ id: q.id }));
}

// --- The Wheel --------------------------------------------------------------

function freezeWheel(
    history: History,
    ownedIds: ReadonlySet<string>,
    rng: () => number,
): ChallengeQuestion[] {
    const pool: { id: string }[] = [
        ...getPack('all').puzzles,
        ...getOwnedPackContent<{ id: string }>('the-wheel', 'en', ownedIds),
    ];
    const picked = createDeck(pool, history, rng).slice(0, TOTAL_PUZZLES);
    return picked.map((p) => ({ id: p.id }));
}
