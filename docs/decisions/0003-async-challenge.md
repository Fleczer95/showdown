# 3. Async challenge over a self-contained shared round

Date: 2026-06-11

## Status

Accepted

## Context

ADR-0001 deferred the social layer to a post-MVP "Async Challenge": a player
shares a result by URL and a friend tries to beat it. We are now pulling that
into the MVP.

The required experience: a player creates a challenge, shares a link, and both
players play their own round on their own devices; afterwards either can open the
same link and see everyone's results and who won. This must work **across
platforms** — an App Store (iOS) player competing head-to-head with a Play Store
(Android) player — since that is a core selling point.

Two clarifications reshaped the design during review:

1. **Create-then-play, not play-then-share.** A challenge is created up front
   from a game's setup screen, *before* anyone plays. The creator is just the
   first participant; the opponent may finish first. Results stay hidden from a
   participant until they have finished their own run.
2. **Results require shared state.** Because each player scores on their own
   device, a purely stateless link (everything encoded in the URL) cannot show
   "both results and who won" — A's device never sees B's number. A small server
   record both phones read and write is therefore required.

The catalogue of remaining choices — backend, link mechanism, identity,
localisation, content ownership, versioning — was worked through one branch at a
time (see the decision below).

## Decision

Build an **async, self-contained, group challenge** backed by Firestore, linked
via a static Universal/App Link domain. No bespoke application server.

- **Backend: Firebase Firestore** (SDK already bundled). The app reads/writes
  directly; there is no server code. A challenge is one document; participant
  results are an `attempts/{uuid}` subcollection. Stays inside the free tier.
- **Link layer: `showdown.lebene.pl`** — a subdomain on the existing seohost
  host with its own static docroot and HTTPS cert. It serves only
  `.well-known/apple-app-site-association` (iOS) and `.well-known/assetlinks.json`
  (Android) plus a store-redirect fallback page. No PHP/backend logic. A domain
  is unavoidable because **iOS has no App Store install-referrer / deferred
  deep-link API** (the gap Firebase Dynamic Links filled before its Aug-2025
  shutdown); Universal Links are the only supported path, and they double for
  Android App Links.
- **Self-contained record.** The frozen round embeds each question's full payload
  in **all locales (en/pl)**, so any opponent can play regardless of which
  premium packs they own (a soft upsell), and plays it in **their own** device
  language. Content is bundled on-device (`getPackContent(id, locale)`), so the
  creator can embed every locale at creation time.
- **Who won: reuse `rankEntries()`** (progress desc → unified points desc →
  oldest timestamp). A challenge attempt is a `LeaderboardEntry` plus the device
  UUID; the result reveal reuses the ranking logic, scoring being deterministic
  given the frozen questions.
- **Identity: a device UUID stored in MMKV**, sent with each attempt. No auth.
  Cross-*platform* competition works (Firestore is platform-neutral);
  cross-*device identity* is explicitly out (reinstall/data-clear = new id),
  which is the right trade-off for a friendly game and preserves the "no setup"
  pillar. Real federated sign-in (Apple + Google into Firebase Auth) is a
  possible post-MVP add-on without changing the data model.
- **Write model / security rules.** The challenge document is **immutable after
  create**; attempts are **create-only, one doc per UUID** (`allow create:
  if !exists(...)`), which structurally enforces one-attempt-per-device and
  blocks tampering with the round or others' scores — the strongest guarantee
  available without auth. Rules validate field shapes and size.
- **Lifecycle.** Each record carries `expiresAt = created + 30 days`; Firestore's
  native TTL auto-deletes it. An expired link shows an "expired, start a fresh
  challenge" state.
- **Versioning.** Records carry `schemaVersion` and `minAppVersion`. An app that
  is older than `minAppVersion` (or does not recognise `schemaVersion`) shows
  "Update to take this challenge" instead of crashing. `lang` records the
  authoring language.

### Record shape

```jsonc
{ schemaVersion: 1, minAppVersion: "0.9.0", appVersion, lang: "pl",
  game, questions: [{ id, byLocale: { en, pl } }], // ordered, frozen
  createdBy: { uuid, nickname },                             // attribution only
  expiresAt }
// attempts/{uuid} -> { nickname, progress, score, timestamp }
```

### Flow

1. On a game's **setup screen**, the user configures a round and taps **Create
   challenge**. The app freezes the deck (built from the creator's history, all
   locales embedded), writes the document, and opens the native share sheet with
   `https://showdown.lebene.pl/c/{id}`.
2. The creator plays it (first attempt). The opponent opens the link, the app
   fetches the frozen record, and they play too. Either may finish first.
3. Each participant sees a **bespoke "You vs {createdBy}" VS intro → normal play
   (no opponent data shown) → write attempt → bespoke result reveal** with the
   ranked board. Results stay hidden until a participant finishes their own run;
   if their UUID already has an attempt, the link opens straight to the results.

## Consequences

- A challenge is online at three moments — **create**, **open**, and **finish
  (write attempt + read others to rank)**. Each is gated: on a failed/timed-out
  Firestore call the app shows a blocking "connect to the internet" + Retry
  screen; the completed run is held locally so nothing is lost. Firestore's
  silent offline write queue is deliberately **not** relied on, since the reveal
  must reflect a confirmed write and a fresh read. `expo-network` may be added
  for a proactive offline check.
- A challenge run calls `markShown` for **owned ids only**, so embedded premium
  questions a participant does not own never pollute their local rotation.
- Records embed full content in every locale, roughly doubling size at two
  locales — negligible now, a consideration if locales multiply.
- Dedup is honour-based: it stops casual/accidental double-attempts but is not
  cheat-proof without sign-in. Acceptable for friendly play.
- New native surface: deep-link config (Universal/App Links), a bespoke VS intro
  and result-reveal screen, and a challenge-builder that resolves a played
  question id to its payload across both free `content.ts` and pack content.
- Operationally there is **no application server to run or maintain** — only
  Firestore (managed) and a handful of static files on existing hosting.
- ADR-0001's "Async Challenge is post-MVP" is superseded: it is now in the MVP.

## Amendment (2026-07-02): Worker/D1 and canonical Challenge Record contract

The implementation now uses a Cloudflare Worker backed by D1 instead of direct
Firestore writes. This is an infrastructure change, not a change to the
[[Async Challenge]] experience: the app still creates an immutable online
Challenge Record, participants still submit one attempt per device UUID, and
the link domain remains the Universal/App Link entry point.

The canonical Challenge Record is the shared app/Worker contract:

```jsonc
{
    "lang": "pl",
    "game": "the-ladder",
    "questions": [{ "id": "ladder-001", "alternates": ["ladder-002"] }],
    "createdBy": { "uuid": "device-uuid", "nickname": "Ada" },
    "expiresAt": 1783000000000,
    "mascot": { "fur": "fur.orange", "suit": "suit.royal", "accent": "accent.crimson", "mic": "mic.gold" },
}
```

Changes from the original record sketch:

- Questions are **id-only**, not embedded all-locale payloads. All free and pack
  content ships on-device, so each device resolves ids locally in its own
  language. Missing ids mean the app must update.
- `mascot` is required. A challenge carries the creator's look as stable
  `{ slot: colorId }` strings so the opponent sees the sender presentation.
  Unknown color ids fall back during rendering; the contract only requires the
  four slots.
- No `schemaVersion` or `minAppVersion` field is carried for now. The shared
  runtime contract validates the current shape, and content-version gaps are
  handled by missing-id detection.

## Amendment (2026-07-20): directed 1:1 rematches without resharing

A completed challenge with exactly two participants may create one directed
follow-up round. The rematch is a new immutable Challenge Record with a fresh
deck, a new TTL, and the other completed participant as its server-derived
recipient; it is never a second attempt on the source record. Each round may
have at most one immediate successor, producing a linear series while still
allowing another rematch after both players finish the new round.

The relationship and recipient are server-only challenge metadata (`rematchOf`
and `recipientUuid`), not part of the canonical Challenge Record contract. The
Worker derives the recipient from the two source attempts and a unique
`rematchOf` index makes retries and simultaneous requests converge on one
successor. The client never supplies an arbitrary recipient UUID.

Delivery is pull-based and scoped to source challenge ids already indexed on
the recipient device. Home and Challenge History synchronise these directed
successors when focused; there is deliberately no push-notification promise.
This preserves ADR-0003's device identity/no-account trade-off and means an app
reinstall or data clear still breaks identity and pending-rematch discovery.
Directed rematches are not shareable from History, because sharing their link
would silently turn the 1:1 follow-up back into a group challenge.
