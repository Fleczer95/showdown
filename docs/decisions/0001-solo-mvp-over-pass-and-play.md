# 1. Solo single-player for MVP, async challenge instead of pass-and-play

Date: 2026-05-30

## Status

Accepted

## Context

The original product concept (`CLAUDE.md`) defined ShowDown as a **local
pass-and-play** collection for small groups (2–4 players) on one phone. The four
games were first built accordingly: The Ladder as a solo climb, but The Grid,
The Opinion Poll, and The Wheel as team games with per-team scores, turn
rotation, and (for Poll) strikes and steals.

In review two problems surfaced:

1. **Single-phone friction.** For Grid/Poll/Wheel the phone holds the hidden
   answer, and having multiple teams take turns — or respond on the same shared
   board (Poll, Wheel) — is awkward on one device. There is no host or buzzer to
   adjudicate, so it leans on the honor system and slows play.
2. **Native form.** Jeopardy-, Family-Feud-, and Wheel-of-Fortune-style games
   all work naturally as **single-player** mobile experiences (you vs. the
   board / survey / puzzle). Solo is arguably their native single-phone form,
   not a compromise.

The design doc already anticipated an "Async Challenge" social layer: shared
deep links that let a friend challenge a specific score.

## Decision

For the MVP, **all four games are single-player (solo)**. Each produces a score
or result. Local pass-and-play and the team/turn/strike machinery are dropped
from the MVP.

The social/competitive layer becomes the **post-MVP Async Challenge**: a player
shares a result by URL/deep link and a friend tries to beat it. This replaces
same-couch multiplayer rather than supplementing it.

## Consequences

- The `CLAUDE.md` concept is updated: ShowDown is a solo game-show collection
  with async challenges, no longer "pass-and-play for 2–4 on one phone."
- Grid/Poll/Wheel logic must be simplified from multi-team to single-player:
  remove `activeTeam`/turn rotation, collapse per-team `scores[]` to one score,
  and redefine each game's loss/round-end conditions for a single player (e.g.
  what a wrong consonant or wrong solve does in The Wheel when there is no team
  to pass to). These are tracked as follow-up rules decisions.
- The `players` prop on play screens and the multi-player ranges in
  `src/data/games.ts` become single-player.
- Revisiting local multiplayer post-MVP is possible but would be a deliberate
  re-expansion, not a default.
