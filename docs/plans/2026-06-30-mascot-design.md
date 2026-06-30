# Showdown Mascot — Design Spec

> Supersedes the original `mascot_plan.md` Rive brief. This version is the result of
> a full design-tree grilling: the tech foundation, animation scope, placement,
> monetization model, and cross-device (challenge) constraints were all resolved.

## 1. Core Identity

- **Role:** Game-show host.
- **Species:** Fox.
- **Personality:** Slick, theatrical, slightly sassy, ultimately encouraging — a
  larger-than-life hype-man. Cheers big wins, shrugs off misses.
- **Base look:** Anthropomorphic fox holding a retro microphone. Bright orange fur,
  vibrant tailored blue suit (high contrast), shiny gold mic. Clean bold lines,
  recognizable silhouette, optimized for mobile.

## 2. Tech Foundation — **SVG/Skia, not Rive**

Rive was rejected. The committed monetization (recolorable cosmetic skins) is
delivered with the stack already in the app, avoiding a new native module and an
unbuildable asset pipeline.

- **Render:** Layered `react-native-svg` fox with **named fill regions**:
  `fur`, `suit`, `suit-accent`, `mic`. Shading/highlights are **separate
  semi-transparent overlay paths** on top of each flat base region (so recolor
  changes the base without flattening the shading).
- **Recolor:** A skin is a palette; at runtime we override the `fill` of each named
  region. "Zero asset bloat" — one vector, N palettes. Fur is just another region.
- **Animation:** `react-native-reanimated` transform/opacity transitions. No Rive
  state machine.
- **Art pipeline:** AI generates a **concept raster only**. The actual deliverable
  is a **hand-cleaned, multi-region SVG** with the named fills above. AI does not
  produce rigged/layered/recolorable assets — treat SVG cleanup as the real art task.
- **Cross-pose consistency:** the 3–4 poses must be the *same* fox with the *same*
  regions; draw them from one reference and clean by hand. AI drifts between gens.

### Sequencing gate (do this first)

Before commissioning/generating final art, build a **throwaway recolor PoC**:
primitive shapes (blue rect = suit, orange blob = fox, gold circle = mic) wired with
the real named fills + Reanimated reactions, running **on a real device**. Prove
fill-override and pose transitions end-to-end. Only then invest in real art.

## 3. Animation / Behavior

- **4-state taxonomy:** `intro`, `idle`, `cheer`, `dismay`. (A distinct `jackpot`
  pose is deferred — add later as one extra pose.)
- **Reaction poses, not continuous animation.** 3–4 hand-posed states with snappy
  Reanimated transitions (scale-pop on cheer, shake/slump on dismay, idle breathing,
  slide-in intro).
- **The mascot is dumb.** It only knows the 4 states. Each game's **Results screen
  classifies its own outcome** into `cheer | dismay` and tells the mascot:
  - Wheel: jackpot → cheer, bankrupt → dismay
  - Ladder: banked → cheer, busted → dismay
  - Grid/Drop: by score threshold
  - Poll: by closeness-to-crowd
  Games stay the authority on what "good" means for them.

## 4. Placement

- **v1:** Home screen (intro/idle, showcases equipped skin) + Results screens
  (cheer/dismay payoff). **No persistent in-play host** (4× integration, fights for
  cramped screen space).
- **Build as a self-contained overlay component** mountable on any screen and
  slid in via a Reanimated transform.
- **Deferred (v2):** host slides in from an edge between rounds to react/message;
  **text quips** ship with this phase (see §6).

## 5. Monetization & Data Model

### Per-slot composition (under the hood **and** exposed in v1)

- A **look** = `{ fur, suit, accent, mic } → colorId`.
- Ownership is tracked **per color**, not per whole-palette.
- **v1 picker = a 4-slot customizer** (fur / suit / accent / mic), plus a few
  one-tap **preset looks** as shortcuts.

### Customizer UX

- The live fox fills the screen.
- Tapping a **region on the fox** *or* an explicit **slot button** (both — small
  regions like the mic are hard to hit, and buttons aid accessibility) slides up a
  **bottom sheet** of that slot's colors.
- **When the sheet opens, the mascot scales down or translates upwards slightly** so the whole fox remains visible during recoloring.
- Selecting a color **recolors the fox live**; selection persists immediately.
- **Sheet ordering:** unlocked colors first, then locked (with lock/price badge).
- Custom slide-up sheet built on `react-native-gesture-handler` + Reanimated
  (no bottom-sheet lib in deps).

### Unlock sources

- **Bought:** a palette **bundle**, single SKU `com.showdown.mascot_skinpack`
  (~$2.99). Avoids cheapening individual recolors; cleaner store.
- **Earned:** individual elements (e.g. a gold mic) via level progression, in
  `src/game/progression/` — **never sold**, mirroring earned themes.

### Locked-swatch behavior

- Tapping a **purchasable** locked color → routes through the **shared billing
  engine** to buy the bundle.
- Tapping an **earned** locked color → **navigates to the progression map** and highlights the target level (the scroll-to-anchor feature is built in v1, see §8).

### Store integration — the seam

- **Separate content + UI:** new `src/data/store/mascotSkins.ts` +
  `MascotSkinDefinition` type; the customizer is the primary conversion surface
  (point-of-desire selling via inline locked swatches). The standalone store screen
  still exists for discovery.
- **Shared commerce:** purchases/restore/ownership go through the existing
  `react-native-iap` plumbing and `MMKVPurchaseAdapter`. Do **not** rebuild billing.
- **New persistence key:** one MMKV key for the **equipped look** — a
  `{ slot: colorId }` map (not a single skin id).

## 6. Deferred to later phases

- `jackpot` / "big win" pose.
- Persistent / between-rounds slide-in host.
- **Text quips** (bilingual EN/PL): per-outcome localized lines, tone-matched,
  with variation + selection. Ships with the between-rounds feature, not v1.
- Patterns / costume swaps (pattern overlay path; the per-slot model already
  accommodates it).
- *(Earned-element deep-link to level was pulled into v1)*

## 7. v2-enabling invariants — **locked in v1**

The v2 idea (challenge recipient sees the *sender's* mascot) requires these now, or
v2 becomes a rewrite. All are near-free if done up front.

1. **Stable string color IDs.** A look serializes to `{ slot: colorId }`; these IDs
   travel in the ADR-0003 challenge payload (Firestore doc / share link). Never
   renumber them.
2. **Ownership-agnostic render path.** A pure `renderMascot(lookMap, pose)` that
   draws *any* valid look map. Ownership gates only **equipping your own** mascot,
   never **displaying** one. The challenge screen calls the same render with the
   sender's map.
3. **Unknown-ID fallback.** A recipient on an older app version (or lacking a newer
   color) gets an unrecognized `colorId` → each slot falls back to its default
   color. Never crash.
4. **Reserve the payload field now.** Add `mascot: { slot: colorId }` to the
   challenge payload schema even though v1 doesn't display it — makes v2 purely
   additive, no migration of existing links.

## 8. Open items / TODO (Resolved Decisions)

- **Performance budget:** We will build the throwaway PoC first (as planned in the Sequencing Gate), measure rendering time on a low-end device, and then set the maximum path/node ceiling based on actual performance data before finalizing the art.
- **Exact v1 color list per slot:** We will provide a generic placeholder palette for the PoC (e.g., 3 standard colors per slot) and define the actual final color list once we have the polished base art.
- **Levels scroll-to-anchor (Pulled into v1):** Tapping an earned color will deep-link to the progression map. We will implement the necessary anchor-scrolling in `ProgressScreen` or `GameSetupScreen` so the target level is highlighted in v1.
