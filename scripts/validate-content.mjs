import { RUNGS } from '../src/game/ladder/content';
import { dropQuestions } from '../src/game/drop/content';
import { PACKS as wheelPacks } from '../src/game/wheel/content';
import { CATEGORIES } from '../src/game/grid/content';

function validateLadder() {
    console.log('Validating Ladder...');
    let errors = 0;
    RUNGS.forEach((rung, rIndex) => {
        rung.forEach((q, qIndex) => {
            if (!q.id) { console.error(`Rung ${rIndex+1}, Question ${qIndex}: Missing ID`); errors++; }
            if (!q.question.en || !q.question.pl) { console.error(`${q.id}: Missing translation in question`); errors++; }
            if (q.options.length !== 4) { console.error(`${q.id}: Expected 4 options, found ${q.options.length}`); errors++; }
            q.options.forEach((opt, oIndex) => {
                if (!opt.en || !opt.pl) { console.error(`${q.id}, Option ${oIndex}: Missing translation`); errors++; }
            });
            if (q.correctIndex < 0 || q.correctIndex >= 4) { console.error(`${q.id}: Invalid correctIndex ${q.correctIndex}`); errors++; }
            if (!q.hint.en || !q.hint.pl) { console.error(`${q.id}: Missing translation in hint`); errors++; }
        });
    });
    console.log(`Ladder validation complete. Errors: ${errors}`);
}

function validateDrop() {
    console.log('Validating Drop...');
    let errors = 0;
    dropQuestions.forEach((q, qIndex) => {
        if (!q.id) { console.error(`Question ${qIndex}: Missing ID`); errors++; }
        if (!q.prompt.en || !q.prompt.pl) { console.error(`${q.id}: Missing translation in prompt`); errors++; }
        if (q.options.length !== 4) { console.error(`${q.id}: Expected 4 options, found ${q.options.length}`); errors++; }
        q.options.forEach((opt, oIndex) => {
            if (!opt.en || !opt.pl) { console.error(`${q.id}, Option ${oIndex}: Missing translation`); errors++; }
        });
        if (q.correctIndex < 0 || q.correctIndex >= 4) { console.error(`${q.id}: Invalid correctIndex ${q.correctIndex}`); errors++; }
    });
    console.log(`Drop validation complete. Errors: ${errors}`);
}

function validateWheel() {
    console.log('Validating Wheel...');
    let errors = 0;
    const puzzles = wheelPacks.all.puzzles;
    puzzles.forEach((p, pIndex) => {
        if (!p.id) { console.error(`Puzzle ${pIndex}: Missing ID`); errors++; }
        if (!p.phrase.en || !p.phrase.pl) { console.error(`${p.id}: Missing translation in phrase`); errors++; }
        if (!p.category.en || !p.category.pl) { console.error(`${p.id}: Missing translation in category`); errors++; }
    });
    console.log(`Wheel validation complete. Errors: ${errors}`);
}

function validateGrid() {
    console.log('Validating Grid...');
    let errors = 0;
    CATEGORIES.forEach((cat, cIndex) => {
        if (!cat.id) { console.error(`Category ${cIndex}: Missing ID`); errors++; }
        if (!cat.name.en || !cat.name.pl) { console.error(`${cat.id}: Missing translation in name`); errors++; }
        if (cat.clues.length !== 5) { console.error(`${cat.id}: Expected 5 clues, found ${cat.clues.length}`); errors++; }
        cat.clues.forEach((clue, clIndex) => {
            if (!clue.clue.en || !clue.clue.pl) { console.error(`${cat.id}, Clue ${clIndex}: Missing translation in clue`); errors++; }
            if (!clue.answer.en || !clue.answer.pl) { console.error(`${cat.id}, Clue ${clIndex}: Missing translation in answer`); errors++; }
        });
    });
    console.log(`Grid validation complete. Errors: ${errors}`);
}

validateLadder();
validateDrop();
validateWheel();
validateGrid();
