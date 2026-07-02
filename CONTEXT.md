# ShowDown — Context Glossary

Ubiquitous language for the ShowDown game collection. This file is a glossary,
not a spec — it defines terms, not implementation. Game-show formats here are
"legally distinct" homages, so we use our own names, never the originals.

ShowDown is **solo** for the MVP: every game is one player vs. the content. The
competitive layer is the post-MVP [[Async Challenge]], not local multiplayer.
See `docs/decisions/0001-solo-mvp-over-pass-and-play.md`.

**MVP scope:** three games ship — [[The Ladder]], [[The Drop]], and
[[The Wheel]]. [[The Grid]] is deferred post-MVP (its code stays in the repo but
is not surfaced in the game list). The Opinion Poll (Family-Feud-style) was cut
entirely and replaced by [[The Drop]].

## Terms

### The Ladder
A solo trivia climb: one player ascends a 15-question curve of increasing
difficulty (Millionaire-style). Outcome is the [[Rung]] reached. Assisted by
[[Lifeline]]s.

### The Grid *(deferred post-MVP)*
A solo category-board trivia game (Jeopardy-style): the player clears a grid of
fixed-value clues, scoring points for correct answers. No wagering. When built,
it will use **ABCD multiple-choice** answers so scoring is objective and
[[Async Challenge]]-comparable (self-judging was rejected for being
unverifiable). Differentiated from [[The Ladder]] by structure: pick-your-order
board with no elimination, vs. an escalating climb with [[Lifeline]]s.

### The Drop
A solo confidence/allocation game (Money-Drop-style). The player holds a [[Bank]]
and, each round, sees one 4-option multiple-choice question and must place the
**entire bank** across **1–3 of the options** (never all four). Each covered
option must hold at least the [[Minimum Stake]]. After the reveal, points on the
correct option survive into the next round; everything on wrong options is lost
("drops"). Points are **preserved at face value — never multiplied** — so the
bank only stays flat or shrinks. The run ends after **9 rounds**, or the instant
the bank hits zero; the final bank is the score. Not a knowledge-recall game —
the skill is risk calibration on surprising **real statistics**. Replaces the
cut Opinion Poll.

### The Wheel
A solo word-puzzle **press-your-luck** game (Wheel-of-Fortune-style). Across
**3 puzzles**, the player spins for a cash value, guesses consonants (a correct
consonant adds value × occurrences to [[Round Cash]]; a wrong consonant just
wastes the spin) and may buy vowels from round cash. **Bankrupt** wipes the
current puzzle's round cash. The player chooses when to **Solve**: a correct
solve **banks** the round cash into the score and advances; a wrong solve ends
the puzzle with nothing banked. Score = total banked across the 3 puzzles. The
tension is greed vs. safety — keep spinning for more, or solve to lock it in.

### Round Cash
The unbanked cash a player is accumulating on the current [[The Wheel]] puzzle.
Built by correct consonants, spent on vowels, wiped by Bankrupt, and converted to
permanent score only by a correct solve.

### Async Challenge *(post-MVP)*
The social/competitive layer that replaces local multiplayer: a player shares a
result via URL/deep link so a friend can attempt to beat that score. (Design
doc: "shared deep links that challenge a specific score.")

### Challenge Record
The immutable online record behind an [[Async Challenge]]. It freezes the game,
the ordered question ids, the creator's identity, expiry time, and the creator's
mascot look. It is the shared contract both devices use to play the same
challenge and show the same creator presentation.

### Rung
The 1-based position a player has reached on [[The Ladder]]. Reaching rung 15
is a win.

### Lifeline
A one-use assist in [[The Ladder]]:
- **50:50** — hides two of the wrong options.
- **Ask the Studio** — reveals a hint / a vote distribution favouring the answer.
- **Skip** — swaps the current question for a **different question at the same
  rung**, which must still be answered. It never advances the climb for free, so
  it cannot be used to win the final rung without answering. (Requires the
  question content to carry spare questions per difficulty level to swap in.)

### Bank
The pool a player carries between rounds in [[The Drop]]. Starts at **1,000,000**,
held as **40 bundles of 25,000** (the placement unit). Can only stay flat or
shrink. The final bank is the player's score.

### Minimum Stake
The smallest amount placeable on a covered option in [[The Drop]]: **one 25,000
bundle**. Because the [[Bank]] is always a whole number of bundles, the number of
options coverable in a round is `min(3, bundles held)` — at 2 bundles you can
cover at most 2 options, at 1 bundle you are forced all-in. No fractional edge
cases.

### Question History
A per-game record of how many times each question has been shown, persisted on
the device. Selection is biased toward the **least-shown** questions so a game
cycles through its whole pool before repeating any — and once all are equal, the
pool reshuffles. Count-based (not boolean "used" flags), so it self-cycles with
no explicit reset. Each question needs a stable id to be tracked.

### Gated Secret
Each game hides its answer (Grid: the clue's answer; Poll: the survey answers;
Wheel: the phrase) behind a deliberate reveal/match/solve. In solo play this
keeps the player from seeing the answer before attempting it; self-judging
(e.g. Correct/Wrong in The Grid) runs on the honor system.
