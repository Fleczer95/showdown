// Read side of the Async Challenge (ADR-0003): turn a frozen `ChallengeRecord`
// back into each game's native runtime state so its existing play screen can run
// the round unchanged, plus the pure gates the Challenge screen branches on.

import type { DropQuestion, DropState } from '../drop/logic';
import { STARTING_BANK } from '../drop/logic';
import type { LadderRun } from '../ladder/logic';
import type { GameState, PuzzleContent } from '../wheel/logic';
import { createGame } from '../wheel/logic';
import { RUNGS } from '../ladder/content';
import { dropQuestions } from '../drop/content';
import { getPack } from '../wheel/content';
import { getPackContent, getPlayablePackIds } from '../../data/store/catalog';
import type { DropQuestionPayload, LadderRungPayload, WheelPuzzlePayload } from './build';
import { SCHEMA_VERSION, type ChallengeLocale, type ChallengeRecord } from './types';

/** Resolve a question's payload for the device locale, falling back to the authoring language. */
function forLocale<T>(byLocale: Record<ChallengeLocale, T>, locale: ChallengeLocale, lang: ChallengeLocale): T {
    return byLocale[locale] ?? byLocale[lang];
}

/** Rebuild The Ladder's run: the frozen rungs in order, ready to climb from the bottom. */
export function ladderRunFromRecord(record: ChallengeRecord, locale: ChallengeLocale): LadderRun {
    const rungs = record.questions.map((q) => {
        const payload = forLocale(q.byLocale as Record<ChallengeLocale, LadderRungPayload>, locale, record.lang);
        return { current: payload.current, alternates: payload.alternates };
    });
    return { rungs, currentIndex: 0, usedLifelines: [], status: 'active' };
}

/**
 * Rebuild The Drop's state. The Drop plays bilingual questions (it localizes at
 * render time), so reconstruct the bilingual shape by zipping the frozen en/pl
 * payloads — locale is irrelevant here.
 */
export function dropStateFromRecord(record: ChallengeRecord): DropState {
    const questions: DropQuestion[] = record.questions.map((q) => {
        const byLocale = q.byLocale as Record<ChallengeLocale, DropQuestionPayload>;
        const { en, pl } = byLocale;
        return {
            id: en.id,
            prompt: { en: en.prompt, pl: pl.prompt },
            options: en.options.map((o, i) => ({ en: o, pl: pl.options[i] })),
            correctIndex: en.correctIndex,
        };
    });
    return { bank: STARTING_BANK, round: 0, status: 'active', questions };
}

/** Rebuild The Wheel's game from the frozen puzzles in the device locale. */
export function wheelGameFromRecord(record: ChallengeRecord, locale: ChallengeLocale): GameState {
    const puzzles: PuzzleContent[] = record.questions.map((q) =>
        forLocale(q.byLocale as Record<ChallengeLocale, WheelPuzzlePayload>, locale, record.lang),
    );
    return createGame(puzzles);
}

// --- Gates ------------------------------------------------------------------

/** Compare dotted numeric versions: <0 if a<b, 0 if equal, >0 if a>b. Non-numeric parts count as 0. */
export function compareVersions(a: string, b: string): number {
    const pa = a.split('.');
    const pb = b.split('.');
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const diff = (parseInt(pa[i], 10) || 0) - (parseInt(pb[i], 10) || 0);
        if (diff !== 0) return diff < 0 ? -1 : 1;
    }
    return 0;
}

export type ChallengeGate = 'ok' | 'expired' | 'updateRequired';

/**
 * Decide whether this app can open a record: an elapsed `expiresAt` is expired
 * (a stale link that slipped past the server TTL), a newer `schemaVersion` or an
 * app older than `minAppVersion` needs an update, otherwise it's playable.
 */
export function gateChallenge(record: ChallengeRecord, appVersion: string, nowMs: number): ChallengeGate {
    if (record.expiresAt <= nowMs) return 'expired';
    if (record.schemaVersion > SCHEMA_VERSION) return 'updateRequired';
    if (compareVersions(appVersion, record.minAppVersion) < 0) return 'updateRequired';
    return 'ok';
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
