import type { ChallengeLocale, ChallengeRecord } from '../types';
import { ladderRunFromRecord, dropStateFromRecord, wheelGameFromRecord } from '../resolve';
import type { LadderCheckpoint, DropCheckpoint, WheelCheckpoint } from './checkpoints';
export function initialCheckpoint(
    record: ChallengeRecord,
    locale: ChallengeLocale,
): LadderCheckpoint | DropCheckpoint | WheelCheckpoint {
    switch (record.game) {
        case 'the-ladder':
            return {
                run: ladderRunFromRecord(record, locale),
                hidden: [],
                audience: null,
                base: 0,
                speed: 0,
                quickWit: false,
            };
        case 'the-drop':
            return { state: dropStateFromRecord(record), allocation: [0, 0, 0, 0], speed: 0 };
        case 'the-wheel':
            return {
                game: wheelGameFromRecord(record, locale),
                phase: 'awaitSpin',
                spinValue: 0,
                filled: [],
                solveMode: false,
                pendingNext: null,
                wrongGuess: null,
                speed: 0,
                clean: 0,
                boughtVowel: false,
                solved: 0,
                sawBankrupt: false,
                bankruptRecovered: false,
            };
        default:
            throw new Error('Unsupported challenge game');
    }
}
