// Read side of the Async Challenge (ADR-0003): resolve a record's frozen question
// ids against this device's on-device content (free bank + every pack, owned or
// not — all packs ship in the app) and rebuild each game's native runtime state
// so its existing play screen runs the round unchanged. Options are shuffled
// locally per device, so two opponents face the same *questions* but not
// necessarily the same option order. An id this app doesn't have — a pack added
// in a newer app version — is the signal to prompt an update (`missingContentIds`).

import type { DropQuestion, DropState } from '../drop/logic';
import { STARTING_BANK } from '../drop/logic';
import type { LadderQuestion, LadderRun } from '../ladder/logic';
import type { GameState, PuzzleContent } from '../wheel/logic';
import { createGame } from '../wheel/logic';
import type { LadderPackCard } from '../ladder/buildRuns';
import { RUNGS } from '../ladder/content';
import { dropQuestions, zipDropCard, type DropPackCard } from '../drop/content';
import { getPack } from '../wheel/content';
import { getPackContent, getGamePackIds, getPlayablePackIds } from '../../data/store/catalog';
import { type ChallengeLocale, type ChallengeRecord } from './types';

/** Device locale narrowed to an embedded one, falling back to the record's authoring lang. */
function playLocale(record: ChallengeRecord, locale: ChallengeLocale): ChallengeLocale {
    return locale === 'en' || locale === 'pl' ? locale : record.lang;
}

/** Fisher–Yates shuffle returning a new array. */
function shuffle<T>(items: T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Shuffle one question's options and re-point its correctIndex (identity-based, so option pairs survive). */
function shuffleOptions<TOption, TQuestion extends { options: TOption[]; correctIndex: number }>(
    q: TQuestion,
): TQuestion {
    const correct = q.options[q.correctIndex];
    const options = shuffle(q.options);
    return { ...q, options, correctIndex: options.indexOf(correct) };
}

// --- On-device content indexes (ownership-independent) ----------------------

/** id → localized Ladder question, across the free bank and every ladder pack. */
function ladderIndex(locale: ChallengeLocale): Map<string, LadderQuestion> {
    const idx = new Map<string, LadderQuestion>();
    for (const rung of RUNGS) {
        for (const q of rung) {
            idx.set(q.id, {
                id: q.id,
                prompt: q.question[locale],
                options: q.options.map((o) => o[locale]),
                correctIndex: q.correctIndex,
                hint: q.hint[locale],
            });
        }
    }
    for (const packId of getGamePackIds('the-ladder')) {
        for (const card of getPackContent<LadderPackCard>(packId, locale)) {
            idx.set(card.id, {
                id: card.id,
                prompt: card.prompt,
                options: card.options,
                correctIndex: card.correctIndex,
                hint: card.hint,
            });
        }
    }
    return idx;
}

/** id → bilingual Drop question (The Drop localizes at render time, so keep both locales). */
function dropIndex(): Map<string, DropQuestion> {
    const idx = new Map<string, DropQuestion>();
    for (const q of dropQuestions) idx.set(q.id, q);
    for (const packId of getGamePackIds('the-drop')) {
        const en = getPackContent<DropPackCard>(packId, 'en');
        const pl = getPackContent<DropPackCard>(packId, 'pl');
        if (en.length !== pl.length) continue;
        en.forEach((card, i) => idx.set(card.id, zipDropCard(card, pl[i])));
    }
    return idx;
}

/** id → localized Wheel puzzle, across the free bank and every wheel pack. */
function wheelIndex(locale: ChallengeLocale): Map<string, PuzzleContent> {
    const idx = new Map<string, PuzzleContent>();
    for (const p of getPack('all').puzzles) {
        idx.set(p.id, { id: p.id, phrase: p.phrase[locale], category: p.category[locale] });
    }
    for (const packId of getGamePackIds('the-wheel')) {
        for (const p of getPackContent<PuzzleContent>(packId, locale)) idx.set(p.id, p);
    }
    return idx;
}

/** Look up an id, throwing when the device lacks the content (guarded upstream by `missingContentIds`). */
function lookup<T>(idx: Map<string, T>, id: string): T {
    const found = idx.get(id);
    if (!found) throw new Error(`Challenge references unknown question id "${id}".`);
    return found;
}

// --- Resolvers --------------------------------------------------------------

/** Rebuild The Ladder's run: each pinned rung plus its Skip alternates, options shuffled locally. */
export function ladderRunFromRecord(record: ChallengeRecord, locale: ChallengeLocale): LadderRun {
    const idx = ladderIndex(playLocale(record, locale));
    const rungs = record.questions.map((q) => ({
        current: shuffleOptions(lookup(idx, q.id)),
        alternates: (q.alternates ?? []).map((id) => shuffleOptions(lookup(idx, id))),
    }));
    return { rungs, currentIndex: 0, usedLifelines: [], status: 'active' };
}

/** Rebuild The Drop's state from the pinned bilingual questions, options shuffled locally. */
export function dropStateFromRecord(record: ChallengeRecord): DropState {
    const idx = dropIndex();
    const questions = record.questions.map((q) => shuffleOptions(lookup(idx, q.id)));
    return { bank: STARTING_BANK, round: 0, status: 'active', questions };
}

/** Rebuild The Wheel's game from the pinned puzzles in the device locale. */
export function wheelGameFromRecord(record: ChallengeRecord, locale: ChallengeLocale): GameState {
    const idx = wheelIndex(playLocale(record, locale));
    const puzzles = record.questions.map((q) => lookup(idx, q.id));
    return createGame(puzzles);
}

// --- Gates ------------------------------------------------------------------

export type ChallengeGate = 'ok' | 'expired';

/** A stale link whose `expiresAt` slipped past the server TTL is expired; otherwise playable. */
export function gateChallenge(record: ChallengeRecord, nowMs: number): ChallengeGate {
    return record.expiresAt <= nowMs ? 'expired' : 'ok';
}

/** The on-device content index for a game's membership checks; empty for an unknown game. */
function contentIds(game: string, locale: ChallengeLocale): Set<string> {
    switch (game) {
        case 'the-ladder':
            return new Set(ladderIndex(locale).keys());
        case 'the-drop':
            return new Set(dropIndex().keys());
        case 'the-wheel':
            return new Set(wheelIndex(locale).keys());
        default:
            return new Set();
    }
}

/**
 * Question ids this record references that this device can't resolve — pinned
 * questions (and Ladder Skip alternates) from a pack the app doesn't have yet.
 * A non-empty result means the player must update before they can play.
 */
export function missingContentIds(record: ChallengeRecord): string[] {
    const known = contentIds(record.game, record.lang);
    const missing: string[] = [];
    for (const q of record.questions) {
        if (!known.has(q.id)) missing.push(q.id);
        for (const id of q.alternates ?? []) if (!known.has(id)) missing.push(id);
    }
    return missing;
}

/**
 * The question ids this player legitimately rotates for a game — free base
 * content plus any owned premium packs. A challenge marks only these as shown,
 * so embedded premium questions the player doesn't own never pollute rotation.
 */
export function ownedQuestionIds(gameId: string, ownedIds: ReadonlySet<string>): Set<string> {
    const ids = new Set<string>();
    if (gameId === 'the-ladder') RUNGS.forEach((rung) => rung.forEach((q) => ids.add(q.id)));
    else if (gameId === 'the-drop') dropQuestions.forEach((q) => ids.add(q.id));
    else if (gameId === 'the-wheel') getPack('all').puzzles.forEach((p) => ids.add(p.id));
    for (const packId of getPlayablePackIds(gameId, ownedIds)) {
        for (const card of getPackContent<{ id: string }>(packId, 'en')) ids.add(card.id);
    }
    return ids;
}
