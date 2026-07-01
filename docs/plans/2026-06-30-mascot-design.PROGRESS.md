# Mascot Implementation — Progress Log

> Resumable progress for `2026-06-30-mascot-design.md`. Update **after each step**.
> Branch: `mascotte`. Another agent should be able to continue from here.

## Status legend
- [ ] not started · [~] in progress · [x] done · [!] blocked (needs user/device)

---

## ▶ Resume prompts — run ONE in a fresh session per phase
Start each phase in a NEW session (keeps context lean). Paste the next phase's prompt.
Every prompt assumes the agent will: read both docs, follow the `executing-plans` skill,
update this file after each step, run `tsc --noEmit` + eslint, and STOP for review before
committing. Mark the phase done here + commit at the end of each session.

**Phase 1 — data model & v2 invariants:**
> Continue the Showdown mascot build, Phase 1. Read `docs/plans/2026-06-30-mascot-design.md`
> (spec) and `docs/plans/2026-06-30-mascot-design.PROGRESS.md` (progress). Phase 0 gate
> passed. Implement Phase 1 only: the `MascotSkinDefinition` type + `src/data/store/mascotSkins.ts`
> catalog (single bundle SKU `com.showdown.mascot_skinpack`), stable string colorIds per slot,
> a pure ownership-agnostic `renderMascot(lookMap, pose)` with unknown-ID→default fallback,
> the equipped-look MMKV key (`{slot: colorId}` map), and reserve the `mascot` field in the
> `ChallengeRecord` payload. Save progress after each step; stop for my review before committing.

**Phase 2 — customizer UI:**
> Continue the Showdown mascot build, Phase 2. Read both mascot docs. Phase 1 is committed.
> Build the customizer screen that replaces `MascotPocScreen` behind the `Mascot` route:
> full-screen live fox via `renderMascot`/`Mascot` (`src/game/mascot/Mascot.tsx`), tap-region
> OR slot-button → bottom sheet of that slot's colors (REUSE `src/components/molecules/BottomSheet.tsx`,
> don't rebuild), mascot scales down/translates up when the sheet opens, live recolor on select +
> immediate persistence via `getEquippedLook`/`setEquippedLook` (`src/game/mascot/equippedLook.ts`),
> unlocked-first then locked-with-badge ordering, plus a few preset looks. Palette/types are in
> `src/game/mascot/look.ts`. Save progress after each step; run tsc/eslint/prettier; stop for review
> before committing.
>
> Phase-2 notes (from Phase 1): `mascotSkins` is NOT in `STORE_CATALOG` yet (Phase 3), so derive a
> swatch's locked/unlocked state from the bundle's `unlocks` array (`src/data/store/mascotSkins.ts`)
> + `DEFAULT_LOOK`, NOT from catalog ownership resolution. The buy path + i18n store copy are Phase 3 —
> Phase 2 only SHOWS locked swatches with a badge, it does not make them purchasable.

**Phase 3 — store / billing integration:**
> Continue the Showdown mascot build, Phase 3. Read both mascot docs. Wire the buy path: a
> locked purchasable swatch routes through the EXISTING react-native-iap + `MMKVPurchaseAdapter`
> plumbing to buy `com.showdown.mascot_skinpack` (do NOT rebuild billing), and surface the pack
> in the standalone store screen for discovery. Save progress after each step; stop for review
> before committing.

**Phase 4 — progression deep-link (scroll-to-anchor):**
> Continue the Showdown mascot build, Phase 4. Read `docs/plans/2026-06-30-mascot-design.md` (spec) and
> `docs/plans/2026-06-30-mascot-design.PROGRESS.md` (progress). Phase 3 is committed (`795241c`) on branch
> `mascotte`. Build Phase 4 only — the progression deep-link for EARNED mascot colors (plan §5 + §8):
>
> SCOPED FACTS (already verified — don't re-derive):
>   - The scroll-to-anchor ALREADY EXISTS. `ProgressScreen` reads `route.params?.focusRewardId`, maps it
>     to a level via `LEVEL_MAP`, and `scrollRef.current?.scrollTo({ y })` (ProgressScreen.tsx ~L132-147).
>     So this phase is mostly WIRING — `MascotScreen` navigates `('Progress', { focusRewardId })`, the same
>     pattern `ThemeScreen` uses for earned themes. Confirm the target level also gets a visual HIGHLIGHT
>     (not just scroll); if highlight is missing, add it.
>   - There are currently ZERO earned colors. The placeholder palette in `src/game/mascot/look.ts` is 3
>     colors/slot; defaults = slot[0]; ALL 8 non-defaults are in the purchasable bundle (`mascotSkins.unlocks`).
>     So Phase 4 must INTRODUCE the earned element(s): a new colorId NOT in `mascotSkins.unlocks`, mapped to a
>     `rewardId` + level in progression. ⛔ DECISION NEEDED FROM USER UP FRONT: which earned element (e.g. a
>     gold mic), at which level / `rewardId`. ASK before building. (Palette is placeholder until §8 final art,
>     so the specific color may be a stand-in — but wire the mechanism against a real `rewardId`.)
>
> STEPS:
>   1. Add the earned mascot element(s) in `src/game/progression/` (NEVER sold; mirror
>      `src/game/progression/themes.ts`). Keep them OUT of `mascotSkins.unlocks` so they don't read as buyable.
>   2. In `MascotScreen`, split locked-swatch behavior: locked PURCHASABLE → existing Phase-3 buy path
>      (`purchaseItem`); locked EARNED → `navigation.navigate('Progress', { focusRewardId })`.
>   3. Resolve earned-unlock state from `useProgression().unlockedRewards` (like `ThemeScreen`); map each
>      earned colorId → its `rewardId`/level. Earned-but-unlocked colors equip like any owned color.
>   4. Ensure `ProgressScreen` scrolls to AND highlights the target level for the mascot `focusRewardId`.
>
> Save progress after each step; run `tsc --noEmit` + eslint + prettier + `npm run i18n:check`; stop for my
> review before committing.

**Phase 5 — placement (Home + Results):**
> Continue the Showdown mascot build, Phase 5. Read both mascot docs. Build a self-contained
> mascot overlay component (slid in via a Reanimated transform), mount it on Home (intro/idle,
> showing the equipped look), and on each game's Results screen have the screen classify its own
> outcome into `cheer|dismay` and tell the mascot. No persistent in-play host. Save progress after
> each step; stop for review before committing.

**Phase 6 — real art:**
> Continue the Showdown mascot build, Phase 6. Read both mascot docs. Replace the primitive PoC
> shapes with the hand-cleaned multi-region SVG fox (same regions `fur`/`suit`/`accent`/`mic` +
> shading overlays) across the 4 poses; apply the node ceiling from the Phase 0 perf read. Then
> delete the throwaway `src/game/mascot/poc/` folder. Save progress after each step; stop for review.

**Phase 7 — IAP provisioning (LAST — only after the final color list is confirmed):**
> Continue the Showdown mascot build, Phase 7. Read both mascot docs. PREREQUISITE: the final per-slot
> color list (plan §8) must be locked — do NOT provision before the palette is confirmed, since the
> $2.99 bundle's value is "unlock all premium swatches" and the swatch set must be final. Provision the
> single non-consumable IAPs for each costume (`com.showdown.mascot_arctic`, `com.showdown.mascot_emerald`, `com.showdown.mascot_plum`) (~$0.99 each) on BOTH stores as DRAFTS for review:
> App Store Connect via the `app-store-connect-api` skill (`AuthKey_TYBAQ9XDGV.p8`), Google Play via the
> `google-play-iap` skill (`google-play-key.json`). Use the localized store copy already in
> `screen.store.item.mascot_*.*`. Mirror the prior theme/pack provisioning runs (see memory:
> theme-iap-provisioning, ladder-ancient-history-provisioning). These are outward-facing store mutations
> — create drafts only, STOP for review before submitting for App Review / activating.

## Codebase facts established (so next agent doesn't re-derive)
- All native deps present: `react-native-svg` 15.12.1, `reanimated` ~4.1.1,
  `gesture-handler` ~2.28.0, `react-native-mmkv` 4.3.1, `react-native-iap` ^14.4.46,
  `@shopify/react-native-skia` 2.2.12.
- Store catalog pattern: `src/data/store/types.ts` (`StoreEntryBase`, union `CatalogEntry`),
  `src/data/store/themes.ts` (example def with `com.showdown.*` sku). Earned items live in
  `src/game/progression/themes.ts` (outside commercial catalog).
- Challenge payload: `src/game/challenge/types.ts` → `ChallengeRecord` is the wire doc to
  extend with reserved `mascot` field (§7.4). Module dir `src/game/challenge/`.
- MMKV usage pattern examples: `src/game/challenge/nickname.ts`, `src/hooks/useSettings.tsx`.
- src top dirs: animations, assets, components, data, game, hooks, i18n, navigation,
  responsive, screens, services, theme, utils.

---

## Phase 0 — Sequencing Gate: throwaway recolor PoC  ⟵ DO FIRST (plan §2)
Prove fill-override + pose transitions end-to-end with PRIMITIVE shapes before real art.
Files (all under `src/game/mascot/poc/` — delete the folder when gate passes):
  - `palette.ts` — `MascotSlot`/`MascotPose`/`LookMap` types, 3-color placeholder
    palette/slot, stable string colorIds (§7.1), `resolveSlotColor` w/ default fallback (§7.3).
  - `MascotPoc.tsx` — primitive-shape fox, named fills + shading overlays, 4 Reanimated
    poses; exports `renderMascot(look, pose)` prototyping the §7.2 signature.
  - `MascotPocScreen.tsx` — dev harness: pose switcher + per-slot swatches.
Wiring (TEMP, `__DEV__`-gated, marked for removal with PoC):
  - `navigation/types.ts` `MascotPoc: undefined` route.
  - `navigation/RootNavigator.tsx` `{__DEV__ ? <Stack.Screen MascotPoc/> : null}`.
  - `screens/HomeScreen.tsx` `__DEV__` Mic IconButton in header → navigate('MascotPoc').
- [x] PoC component: layered SVG, named fills + semi-transparent shading overlays.
- [x] 4 poses `intro|idle|cheer|dismay` via Reanimated (pop/shake-slump/breathe/slide-in),
      respects `useReducedMotion`.
- [x] Runtime fill override from a `{slot: colorId}` look map.
- [x] Mountable screen + temporary `__DEV__` dev entry on Home (Mic icon).
- [x] Static checks: `tsc --noEmit` clean, eslint clean, prettier formatted.
- [x] VERIFIED ON DEVICE (user, 2026-06-30): "recolors are quite smooth and works".
      GATE PASSED → Phase 1 unblocked. (Perf felt fine; formal node ceiling still TBD at art.)

### Entry-point relocation (user request, 2026-06-30)
Mic-on-Home dev entry REMOVED. Mascot now has a permanent Settings row, mirroring Themes:
  - Route renamed `MascotPoc` → **`Mascot`** (no longer `__DEV__`-gated) in
    `navigation/types.ts` + `RootNavigator.tsx`; still renders `MascotPocScreen`
    as a placeholder until the Phase 2 customizer replaces it.
  - `screens/SettingsScreen.tsx`: new disclosure row in the Appearance section
    (Drama icon) under Theme → `navigation.navigate('Mascot')`.
  - i18n `screen.settings.labels.mascot` added to `en.json` ("Mascot") + `pl.json`
    ("Maskotka"). NOTE: locale JSON files are NOT prettier-formatted in this repo
    (pre-existing) — match the 16-space indent, do NOT run prettier --write on them.
  - `screens/HomeScreen.tsx` reverted (Mic import + dev IconButton removed).

## Phase 1 — Data model & v2-locked invariants (§5, §7)  ⟵ AWAITING REVIEW (uncommitted)
- [x] `MascotSkinDefinition` type (`src/data/store/types.ts`, added to `CatalogEntry` union) +
      `src/data/store/mascotSkins.ts` catalog (single bundle SKU `com.showdown.mascot_skinpack`,
      $2.99 fallback). `unlocks` = every non-default palette colorId.
- [x] Stable string color IDs per slot (never renumber) — promoted PoC palette verbatim into the
      permanent `src/game/mascot/look.ts` (3/slot placeholder, §8).
- [x] Pure `renderMascot(lookMap, pose)` — ownership-agnostic, unknown-ID → slot default.
- [x] MMKV equipped-look key (`src/game/mascot/equippedLook.ts`): `{ slot: colorId }` map under
      `mascotLook`, defaults fill missing slots.
- [x] Reserve `mascot?: Record<string,string>` in `ChallengeRecord` (additive, no migration).
- [x] Static checks: `tsc --noEmit` clean, eslint clean, prettier clean, 34/34 store tests pass.

### Structural decision (flag for review)
The renderer was PROMOTED OUT of throwaway `poc/` so permanent consumers (Phase 2 customizer,
Phase 5 Home/Results, v2 challenge) never import from a folder deleted in Phase 6:
  - `src/game/mascot/look.ts` — canonical palette/types/`resolveSlotColor` (was `poc/palette.ts`).
  - `src/game/mascot/Mascot.tsx` — `Mascot` component + `renderMascot()` (was `poc/MascotPoc.tsx`),
    SVG moved VERBATIM (device-verified art unchanged; still placeholder primitives until Phase 6).
  - DELETED `poc/palette.ts` + `poc/MascotPoc.tsx`. `poc/MascotPocScreen.tsx` stays as the dev
    harness (now imports `../look` + `../Mascot`); Phase 2 replaces it, Phase 6 deletes the folder.
  - Phase 6 now just swaps the SVG shapes in `Mascot.tsx` + removes the leftover harness.

### Deferred to Phase 3 (noted so it isn't missed)
  - `mascotSkins` is NOT yet in `STORE_CATALOG` (catalog.ts) — keeps the unprovisioned SKU from
    being queried before the buy path exists. Phase 3 adds `...mascotSkins` + the `screen.store.item.
    mascot_skinpack.*` / `screen.store.feature.mascot_skinpack_*` i18n copy (en.json + pl.json).
  - `mascot-skinpack` IAP product is NOT yet provisioned on either store (Phase 3).

## Phase 2 — Customizer UI (§5)  ⟵ AWAITING REVIEW (uncommitted)
- [x] Full-screen live fox; tap region OR slot button opens bottom sheet.
- [x] Slide-up sheet — REUSED existing `BottomSheet.tsx` (gesture-handler + reanimated), not rebuilt.
- [x] Mascot scales down (0.78) / lifts up (`-scale(56)`) when sheet opens; spring, respects reduced-motion.
- [x] Live recolor on select; persist immediately via `setEquippedLook`; unlocked-first then locked w/ lock badge.
- [x] Preset shortcuts (`MASCOT_PRESETS` in `look.ts`): classic (all-default, applicable) + 3 that read as
      locked until the bundle is owned.
- [x] Static checks: tsc clean, eslint clean, prettier (TS only) clean, i18n en/pl 459/459 synced.

### Decisions / notes (flag for review)
- New screen `src/screens/MascotScreen.tsx` (sits with the other screens, not in `poc/`). `RootNavigator`
  now points the `Mascot` route at it; the old `MascotPocScreen` import is gone, so the throwaway
  `src/game/mascot/poc/` folder is now ORPHANED (no remaining importers) — Phase 6 still deletes it.
- **Lock derivation (per Phase-1 note):** `LOCKED_IDS = new Set(mascotSkins.flatMap(s => s.unlocks))`,
  NOT catalog ownership (mascotSkins isn't in STORE_CATALOG until Phase 3). Defaults are free; everything in
  `unlocks` shows a lock badge and is non-selectable. NO buy path wired (Phase 3). When Phase 3 lands real
  ownership resolution, swap this derivation for the resolved owned-set.
- **Tap-on-fox zones** are approximate rects over the placeholder art (computed from the 200×220 viewBox via
  `k = size/200`), layered inside the same lift/shrink transform as the fox. They are coupled to the current
  primitive shapes — Phase 6 art swap must re-fit `HIT_ZONES` (slot buttons are the robust path regardless).
  NOTE: the hit zones use the PLAIN RN `Pressable`, not `HapticPressable` — HapticPressable applies `style`
  to an inner view, which collapses an absolutely-positioned overlay to a zero-size target (first device-test
  bug: fox taps dead, buttons fine). Keep overlays on RN `Pressable`.
- i18n: added `screen.mascot.{title,subtitle,slots.*,presets.*}` to en.json + pl.json (16-space-style nesting,
  no prettier on locales). `screen.settings.labels.mascot` row already routed here from Phase 0.
- Customizer renders the fox in `idle` pose only (pose switching was a PoC-harness concern, not a Phase 2 req).

## Phase 3 — Store / billing integration (§5)  ⟵ AWAITING REVIEW (uncommitted)
- [x] Registered `...mascotSkins` into `STORE_CATALOG` (`catalog.ts`); ownership now resolves via the
      real catalog path (`resolveEntryState` + `purchasedItemIds`), matching the theme pattern.
- [x] Buy path wired in `MascotScreen`: a tapped locked swatch OR locked preset routes through the
      EXISTING `useStore().purchaseItem(skin.id)` flow (react-native-iap + `MMKVPurchaseAdapter`) to buy
      `com.showdown.mascot_skinpack`. Billing NOT rebuilt — same hook/engine as theme & pack buys.
- [x] Lock derivation REPLACED: Phase-2 `LOCKED_IDS = mascotSkins.flatMap(unlocks)` swapped for an
      ownership-resolved `lockedIds` (`useMemo` over `purchasedItemIds` → `resolveEntryState`). On a
      successful purchase `purchasedItemIds` flips reactively → lock badges clear, swatches equippable.
- [x] i18n store copy added (en + pl): `screen.store.item.mascot_skinpack.{title,desc}` +
      `screen.store.feature.mascot_skinpack_{1,2}` (16-space style, no prettier on locales).
- [x] Surfaced in the standalone Store screen for discovery: mascot bundle shows in the cosmetics
      (Themes) tab — `StoreScreen` section filter now includes `kind === 'mascotSkin'`; added `drama`
      → `Drama` to `STORE_ICONS` so the card/detail icon resolves.
- [x] Static checks: tsc clean, eslint clean, prettier clean (TS files I touched), i18n:check passes,
      34/34 store tests pass.

### Decisions / notes (flag for review)
- **Testable in DEV without provisioning.** `USE_MOCK_IAP` is on under `__DEV__`, so tapping a locked
  swatch runs the mock `PurchaseEngine.purchaseItem` (1.5s → marks owned). The buy path can be exercised
  end-to-end on-device in a dev build right now. The REAL-store path needs the `com.showdown.mascot_skinpack`
  IAP product provisioned in App Store Connect + Google Play first (separate step, not done).
- **Locked swatches are now actionable** (the buy trigger), so `disabled` moved from `locked` →
  `isProcessing` on both swatches and preset chips (prevents double-fire during the in-flight purchase;
  `buyColor` also guards on `isProcessing`). Lock badge + dimming stay as the "needs purchase" affordance.
- **No auto-equip after purchase** (kept minimal + robust): real IAP resolves `purchaseItem` before the
  unlock lands in `onPurchaseSuccess`, so the freshly-bought color can't be equipped synchronously. The
  reactive `purchasedItemIds` clears the locks; the user taps the now-unlocked swatch to equip. Mirrors
  `StoreScreen.handlePurchase` (which also doesn't rely on immediate ownership).
- **Store surfacing placement:** put the bundle in the existing Themes/cosmetics tab rather than adding a
  new top-level store category (one-line section-filter change, no new category i18n). Catalog order keeps
  themes first, the mascot pack after.
- **Pre-existing:** `src/screens/store/StoreScreen.tsx` was already not prettier-clean before this phase
  (verified via stash) — left as-is per surgical-changes rule; my 3-line edit conforms.

## Phase 4 — Progression deep-link, scroll-to-anchor (§5, §8 — pulled into v1)  ⟵ AWAITING REVIEW (uncommitted)
USER DECISION (2026-06-30): earned element = **Platinum mic** (`mic.platinum`, reward `mascot-mic-platinum`,
hex #E5E4E2 stand-in) at **Level 35**.
- [x] Earned mascot elements in `src/game/progression/` (never sold). New `mascotColors.ts` mirrors `themes.ts`/
      `signatures.ts`: `PROGRESSION_MASCOT_COLORS` binds rewardId→{slot,colorId,titleKey}; `EARNED_MASCOT_COLOR_IDS`
      set. Exported from `progression/index.ts`. New swatch `mic.platinum` appended to `MASCOT_PALETTE.mic` in
      `look.ts`. `LEVEL_MAP` L35 now carries `rewardId: 'mascot-mic-platinum'` (was rewardless). `mascotSkins.ts`
      `BUNDLED_COLOR_IDS` now ALSO filters out `EARNED_MASCOT_COLOR_IDS` so the earned color is NOT in the bundle's
      `unlocks` (reads as earned, not buyable).
- [x] Locked earned swatch → navigate to progression map, highlight target level. `MascotScreen` lock derivation
      now splits: earned color locked iff `!unlockedRewards.has(reward)` (via `useProgression`), purchasable color
      locked via the bundle path. New `handleLocked()` dispatch: earned → `navigation.navigate('Progress',
      { focusRewardId })` (ThemeScreen pattern, `as any`), purchasable → existing `buyColor`. `equipColor` +
      `applyPreset` both route through it. Earned-but-unlocked colors equip like any owned color.
- [x] Anchor-scroll + highlight in `ProgressScreen`. Scroll + `FocusGlow` halo ALREADY worked for any rewardId
      (gated on `node.level === focusLevel`, derived from `LEVEL_MAP` — no change needed). Added the mascot reward
      TYPE so the node labels correctly: `mascot-*` → `PROGRESSION_MASCOT_COLORS` lookup → `progression.rewardMascot`
      label + color titleKey (previously any non-signature rewardId mislabeled as `progression.themes.*`).
- [x] i18n EN+PL: `progression.rewardMascot` + `progression.mascotColors.platinumMic` (16-space style, no prettier
      on locales). tsc clean, eslint clean, prettier clean (TS), i18n:check ✅, 34/34 store tests pass.

### Decisions / notes (flag for review)
- **Earned color is a 4th mic swatch.** `mic` slot now has 4 colors (gold=default, silver+rose=bundle,
  platinum=earned); other slots still 3. Hex #E5E4E2 is a stand-in until §8 final art — the rewardId/level/colorId
  are permanent (§7.1), only the hex changes at art time.
- **`mascotSkins.ts` import direction:** now imports `EARNED_MASCOT_COLOR_IDS` from `game/progression/mascotColors`
  (not the index, to keep the surface small / avoid pulling the whole progression barrel). No cycle (progression
  never imports data/store).
- **`ProgressScreen` was prettier-clean at HEAD** (unlike StoreScreen) — confirmed `prettier --write` touched ONLY
  my 26-line edit region, so I let it format my additions (clean-up-own-mess, not the leave-dirty precedent).
- **No new earned PRESET.** The existing 4 presets don't reference `mic.platinum`, so a preset's locked color is
  always purchasable → `handleLocked` still routes presets to buy. Mechanism is preset-agnostic if one is added later.

## Phase 5 — Placement (§4)  ⟵ AWAITING REVIEW (uncommitted)
- [x] Self-contained overlay component `src/game/mascot/MascotOverlay.tsx`: absolutely-positioned,
      `pointerEvents='none'`, reads `getEquippedLook()` and renders `Mascot` via a `pose` prop. Slides in
      from the anchored edge via a Reanimated `translateX` spring; re-reads the look + replays the slide on
      `useFocusEffect` (so a freshly-equipped look shows on return). Respects `useReducedMotion` (no slide).
- [x] Home: `<MascotOverlay>` mounted in `HomeScreen` (bottom-right, size 120, lifted above the footer).
      Home owns the intro→idle beat — a `useFocusEffect` sets pose `intro` then flips to `idle` after 650ms.
- [x] Results: wheel/ladder/drop each classify their OWN outcome and pass the pose (games stay the authority):
      Wheel `game.status === 'over' ? cheer : dismay`; Ladder `won ? cheer : dismay` (banked vs busted);
      Drop `won ? cheer : dismay` (won = `bank > 0`, the score threshold).
- [x] Results layout (user requests, device-verified): the mascot is placed **inline** in the game-over card
      header — a big fox (size 150) on the LEFT with the title + score column pushed to the RIGHT (was a
      floating bottom-right overlay, then a small inline top-left). Used `MascotOverlay inline`: in-flow so it
      scrolls with the card content, but still slides in (from the left, since the fox leads the row). Each
      screen wraps its header in `<Stack direction='horizontal'>` with the title+score in a `flex={1}` column.
      Per user feedback: REMOVED the centered game-icon medallion from `GameOverCard` (the fox now anchors the
      header) and moved the `ScoreBreakdownLine` (Baza·Tempo·Bonus) OUT of the right column to a FULL-WIDTH
      centered line below the two-column row. Verified on the iOS simulator (Drop + Ladder game-over).
- [x] Inline vertical centering (user feedback): the fox hung low because (a) the drawn fox only occupies
      y∈[34,210] of the old 0–220 viewBox — big empty top/bottom margins — and (b) the `dismay` pose slumped
      `translateY +10`. FIX (user's suggestion to "trim the margins"): `Mascot` now frames tight —
      `MASCOT_VIEWBOX = {minY:30, width:200, height:184}`, `height = size * MASCOT_ASPECT` — so the rendered box
      ≈ the fox and `align='center'` centres it precisely. Width stays 200 so the px/unit scale is uniform on
      both axes; the customizer's hit-zones just offset their `top` by `minY` (`(z.y - minY) * k`) and its stage
      height uses `MASCOT_ASPECT` — taps stay aligned. The `dismay` slump was softened `10 → 4`. Removed the
      earlier `-size*0.06` inline lift hack (the tight frame makes it unnecessary). Device-verified on Drop loss.
- [x] Result palette cohesion (user feedback — "too many colours"): the leaderboard/save-score section now
      uses the GAME ACCENT instead of the coral `primary` (matching the Play-Again button). `Leaderboard`
      resolves the accent from `gameId` (`resolveAccent`) and applies it to the new-record box bg/border, the
      "Świetny wynik!" label, the Save button (`backgroundColor`/`textColor`), the highlighted board row, and
      the nickname `Input` focus border (added an optional `accentColor` prop to the shared `Input`). The score
      number keeps its semantic win=success / loss=error colour. Verified on the Drop game-over.
- [x] Tap-to-react (user request): tapping the fox plays a quick jump+squash bounce with a light haptic.
      Overlay mode is `box-none` (taps pass through to buttons); inline mode is a normal in-flow Pressable.
      Bounce respects reduced-motion (haptic only, no movement).
- [x] Static checks: tsc clean, eslint 0 errors (2 PRE-EXISTING ladder warnings @L135, not mine), new
      `MascotOverlay.tsx` prettier-clean, i18n:check ✅ (no new keys — text quips stay deferred to §6).

### Decisions / notes (flag for review)
- **Scope = 3 live games.** Grid/Poll routes were retired with the solo pivot (`data/games.ts`, `playScreens.ts`),
  so only the-wheel/the-ladder/the-drop have reachable Results. The spec's Grid (score threshold) / Poll
  (closeness-to-crowd) classifiers have no screen to live on; Drop already embodies the "by score threshold" rule.
- **Container slide-in vs. Mascot pose.** The overlay container provides the placement entrance (edge slide);
  the `Mascot` pose layers personality on top (intro rise/fade, idle breathe, cheer pop, dismay slump). On Home
  the two compose into a diagonal "host arrives" entrance; on Results the slide + cheer/dismay reads as the host
  sliding in to react. Both honor reduced-motion independently.
- **No catalog/persistence rebuild.** Reuses `getEquippedLook` (Phase 1) and `Mascot`/`renderMascot` verbatim —
  no new look state. Art is still placeholder primitives (Phase 6 swaps the SVG; overlay/poses unaffected).
- **Prettier on the 3 play screens + HomeScreen left as-is:** all 4 were ALREADY prettier-dirty at HEAD (same
  pre-existing condition as StoreScreen in Phase 3). Did NOT `prettier --write` them (would balloon the diff with
  unrelated reformatting); only the NEW `MascotOverlay.tsx` was formatted. The wheel/ladder wrapper `<View>` keeps
  the inner ScrollView at its original indent to stay surgical in the already-dirty files.
- **No persistent in-play host, no text quips** — both deferred per §4/§6; this phase is Home + Results only.

## Phase 6 — Real art (§2, after PoC perf budget set)  ⟵ AWAITING REVIEW (uncommitted)
- [x] Hand-authored multi-region SVG fox host replaces the placeholder primitives in `Mascot.tsx`.
      Same 4 named base regions recolored from the look map (the seam intact): `fur` (head/ears/tail/paw),
      `suit` (jacket/lapels/raised sleeve), `accent` (necktie), `mic` (grille head). SHADE/HILITE overlays
      (inner-ear shade, muzzle/tail-tip/chest highlights, lapel + tie + body shading, mic specular) drawn ON
      TOP, never recolored (§2). Fixed dark facial features (eyes/nose/grin) + neutral mic stick read on any
      palette. Drawn to the SAME bounds — `MASCOT_VIEWBOX` unchanged (`{minY:30,width:200,height:184}`); fox
      spans x∈[18,184], y∈[34,213], centered.
- [x] **Single-shape + transforms** (NOT per-pose shape variants). Phase 0 device-verified this path smooth;
      the 4 poses (intro/idle/cheer/dismay) stay driven purely by the existing Reanimated transform/opacity
      block — recolor seam stays trivially correct, no per-pose region duplication. Animation code untouched.
- [x] Node ceiling applied: new `MASCOT_NODE_CEILING = 40` exported + documented. Art draws **30** nodes
      (Phase 0 ran ~24 smooth on device; 40 leaves headroom for jackpot/patterns before a re-measure).
- [x] `HIT_ZONES` in `MascotScreen.tsx` re-fitted to the new region positions (ears+head, tail, jacket, tie,
      mic+grip). Slot buttons remain the robust fallback. Tap-on-fox still needs a device pass to confirm.
- [x] Deleted the orphaned `src/game/mascot/poc/` folder (`git rm`; only `MascotPocScreen.tsx` remained — no
      importers since Phase 2). Fixed the lingering `poc/` doc reference in `look.ts`.
- [x] Static checks: tsc --noEmit clean, eslint clean (mascot/screen files), prettier clean (touched TS),
      i18n:check ✅ (no key changes — text quips stay deferred §6).

### Decisions / notes (flag for review)
- **Pure hand-authored vector, no AI raster step.** The §2 pipeline says "AI generates a concept raster, then
  hand-clean to SVG." No raster generator is wired into this environment, so the deliverable was authored
  directly as clean react-native-svg `Path`/`Polygon`/`Ellipse` geometry — which IS the "hand-cleaned
  multi-region SVG" §2 actually asks for. The art is a first, coherent pass (geometrically sound fox host);
  **needs a device look** to judge aesthetics — expect to iterate on proportions/expression from your review.
- **Same single shape set across all 4 poses** — see above. If you later want pose-specific shapes (e.g. a
  wide-open cheer mouth), that's an additive change: keep the same 4 named regions per variant.
- **VIEWBOX unchanged**, so every Phase 5 placement (Home overlay, the 3 Results headers, customizer) stays
  centered with no caller changes. Re-verify those 5 render sites + tap-on-fox on the next device build.
- **§8 palette unlock:** with the polished art in place, the final per-slot color list can now be locked off
  it — once you confirm the palette, Phase 7 (IAP provisioning) is unblocked.
- **Tail-tip (device-verified on sim):** first pass put a translucent-white (`HILITE`) disc mid-tail — it
  spilled past the silhouette onto the dark bg and read as a grey ghost. Fixed: the cream tail tip is now a
  **solid** fill (`#F8E6CE`, never ghosts) shaped to sit **inside** the curl's end — the classic white-tipped
  fox tail. (Translucent overlays still suit soft form highlights like muzzle/chest; a hard marking needs a
  solid bounded shape.) Plus a tiny `SHADE` notch where the tail tucks behind the body for depth.
- **Suit shading (device-verified on sim):** the lower-left body shade was a big hard-edged `SHADE` polygon —
  read as a darker panel, not shading. Replaced with a slim sliver down the jacket's left edge.
- **Tail tip — caps the curl + curved separation (user feedback ×2):** first the cream tip was too small and
  "near the end"; now it caps the whole END of the curl. Then the inner cut read as a straight line; replaced
  with a soft curve so the cream→fur boundary looks furry, not sliced.
- **Friendlier face (user feedback "too evil"):** the down-angled `Line` brows formed a stern V — swapped for
  soft raised arched brows (`Path` arcs). Eyes rounded + enlarged (rx8→9) with a second sparkle catchlight each
  → warm, not mean.
- **Mic = retro ball microphone (user feedback "lollipop"):** the plain grille ellipse now has a dark collar
  joint + three `SHADE` grille mesh lines (one horizontal, two vertical arcs) + form shadow + specular — reads
  as a microphone. Node count rose 30→36 (still under the 40 ceiling; comment updated). All device-verified.
- **Mic repositioned (user feedback "wizard holding an orb"):** the microphone was moved to point directly
  at the mouth (angled down-right to the paw) instead of straight up to the side, maintaining a clear
  separation from the right eye. The paw was slightly adjusted to cover the sleeve seamlessly, and the grille
  mesh lines were tilted 45 degrees to match the new axis. `HIT_ZONES` in `MascotScreen` re-fitted.
- **Ears rounded (user feedback):** the sharp, straight `Polygon` fox ears were replaced with `Path` elements
  using quadratic and cubic bezier curves (`Q`, `C`) for a softer, more rounded, friendly appearance.
- **Mouth (user feedback "black curly mouth"):** the W-shaped grin that curled up at the ends was replaced
  with a simple short philtrum + a single gentle smile arc. Cleaner/friendlier. Device-verified on the default
  look (orange fur / blue suit / gold mic) — the gold mic shows the ball-mic read best.
- **Arm/hand/mic redesign (user feedback over several passes, device-verified via a grill-me interview):**
  Iterated through: curved SHADE strokes (still read as shadow) → bordered two-hand "A" arms (`OUTLINE`
  border added) → arms still read as thin outlined "cord/noodles" because same-colour-on-same-colour only
  shows the border. Grilled the direction and locked a **one-handed host pose**:
  1. **New `OUTLINE` (`rgba(0,0,0,0.32)`) border on the suit** — the jacket SILHOUETTE + the ARM only (NOT
     the lapels: the lapel triangle edges read as stray diagonal lines on the chest, so they stay
     borderless). A NOT-recolored overlay (darkens any resolved suit colour, same seam rule as SHADE/HILITE).
  2. **One-handed pose** (user decision): ONE chunky right arm (solid `suit` + `OUTLINE` border) from the
     shoulder down to a single paw that grips the mic. Left shoulder is plain (balanced by the tail). No
     cross-body arm → the tie stays fully visible.
  3. **Tonal separation is what makes it read as a limb:** a `HILITE` overlay down the raised forearm makes
     it a LIGHTER tone than the flat jacket, so its whole body reads as a rounded arm in front of the torso,
     not just an outline. (The border alone was insufficient on same-colour geometry.)
  4. **Mic held low at collar** (user decision), right of the tie: ball `(126,150) r15`, so the full smile
     is clear above it and the tie is clear to its left. Removed the second forearm + second paw + its
     crease. `HIT_ZONES` mic rect re-fitted to `{x:110,y:135,w:42,h:50}`. Node count still under the 52
     ceiling. tsc/eslint/prettier all clean.

## Phase 7 — IAP provisioning (LAST; gated on the final color list — §5, §8)
> Code-side commerce shipped in Phase 3; only the store-side product is missing. Do this LAST because
> the bundle sells "unlock ALL premium swatches" — the swatch set must be frozen first (Phase 6 art +
> §8 final palette). Until then the SKU stays unprovisioned and the buy path is dev-only (mock IAP).
- [x] Confirm final per-slot color list is locked (prerequisite).
- [x] App Store Connect: non-consumable `com.showdown.mascot_arctic`, `com.showdown.mascot_emerald`, `com.showdown.mascot_plum` (~$0.99) DRAFT (`app-store-connect-api` skill).
- [x] Google Play: managed product `com.showdown.mascot_arctic`, `com.showdown.mascot_emerald`, `com.showdown.mascot_plum` (~$0.99) DRAFT (`google-play-iap` skill).
- [x] Reuse `screen.store.item.mascot_*.*` copy; mirror prior theme/pack provisioning runs.
- [x] Drafts only — STOP for review before submitting / activating (outward-facing store mutations).

## Deferred (not v1): jackpot pose, between-rounds host, text quips (EN/PL),
## patterns/costume overlays.

---

## Log
- 2026-06-30: Created progress file. Reviewed plan + codebase. Starting Phase 0 PoC.
- 2026-06-30: Phase 0 PoC BUILT + static-checked. Blocked on real-device verify (user).
  Note for Phase 2: a reusable `src/components/molecules/BottomSheet.tsx` already exists
  (gesture-handler + reanimated, drag-to-dismiss) — reuse it, don't rebuild.
  Note for Phase 4: `Progress` route already accepts `{ focusRewardId?: string }` — the
  deep-link param is half-wired; check `ProgressScreen` for existing anchor/highlight.
  NEXT AGENT: do not start Phase 1 until the device-verify gate passes (plan §2 forbids
  investing past the PoC first). If user confirms gate passed, proceed to Phase 1.
- 2026-06-30: GATE PASSED (device-verified smooth). Relocated entry from Home dev-Mic to a
  permanent Settings → Appearance "Mascot" row (like Themes); route is now `Mascot`. Static
  checks clean. NEXT: Phase 1 (data model + v2 invariants), then Phase 2 customizer which
  replaces `MascotPocScreen` behind the `Mascot` route.
- 2026-06-30: Phase 1 BUILT (data model + v2 invariants). 5 deliverables done; tsc/eslint/
  prettier/store-tests all clean. Promoted the renderer + palette OUT of `poc/` into permanent
  `src/game/mascot/{look.ts,Mascot.tsx,equippedLook.ts}` (see "Structural decision" above) so
  Phase 2/5/v2 consumers don't depend on the soon-deleted poc folder. `mascotSkins` defined but
  intentionally not yet in STORE_CATALOG (Phase 3). AWAITING USER REVIEW before commit. NEXT
  (after approval): commit, then Phase 2 customizer (reuse `BottomSheet.tsx`, call `renderMascot`/
  `Mascot` + `getEquippedLook`/`setEquippedLook`).
- 2026-06-30: Phase 2 BUILT (customizer UI). New `src/screens/MascotScreen.tsx` replaces `MascotPocScreen`
  behind the `Mascot` route: full-screen idle fox + tap-region/slot-button → REUSED `BottomSheet` of that
  slot's colors, fox lifts+shrinks on open, live recolor + immediate `setEquippedLook` persist, unlocked-first
  then locked-with-badge, 4 presets (`MASCOT_PRESETS` added to `look.ts`). Lock state derived from the bundle
  `unlocks` array (no catalog ownership / no buy path — that's Phase 3). i18n `screen.mascot.*` added EN+PL
  (459/459). tsc/eslint/prettier clean. `poc/` folder now orphaned (Phase 6 deletes it). AWAITING USER REVIEW
  before commit. NEXT (after approval): commit, then Phase 3 (wire buy path through existing IAP plumbing).
- 2026-06-30: Phase 3 BUILT (store/billing integration). `...mascotSkins` registered in `STORE_CATALOG`;
  `MascotScreen` lock derivation swapped from bundle-`unlocks` to ownership-resolved (`resolveEntryState` +
  `purchasedItemIds`); tapped locked swatch/preset routes through the EXISTING `useStore().purchaseItem`
  flow to buy `com.showdown.mascot_skinpack` (billing NOT rebuilt); buy clears locks reactively. i18n
  `screen.store.item/feature.mascot_skinpack*` added EN+PL; bundle surfaced in the Store cosmetics tab
  (+`drama` icon). tsc/eslint/prettier clean, i18n:check passes, 34/34 store tests pass. Buy flow is
  testable in a DEV build via mock IAP NOW; real-store needs the IAP product provisioned (separate step).
  AWAITING USER REVIEW before commit. NEXT (after approval): commit, then Phase 4 (progression deep-link).
- 2026-06-30: Phase 4 BUILT (progression deep-link for earned mascot colors). USER DECISION: Platinum mic
  (`mic.platinum`, reward `mascot-mic-platinum`) at Level 35. New `progression/mascotColors.ts` (mirrors
  themes/signatures, never sold); `mic.platinum` swatch added to palette; L35 node now grants the reward;
  `mascotSkins` bundle excludes earned colorIds. `MascotScreen` splits locked-swatch behavior — earned →
  `navigate('Progress', { focusRewardId })`, purchasable → existing buy path — and resolves earned state from
  `useProgression().unlockedRewards`. `ProgressScreen` scroll+`FocusGlow` highlight already worked for any
  rewardId; added the `mascot-*` reward type for correct node labeling (`progression.rewardMascot`). i18n EN+PL
  added. tsc/eslint/prettier clean, i18n:check ✅, 34/34 store tests pass. AWAITING USER REVIEW before commit.
  NEXT (after approval): commit, then Phase 5 (placement — Home + Results overlay).
- 2026-06-30: Phase 5 BUILT (placement). New self-contained `src/game/mascot/MascotOverlay.tsx` (absolute,
  pointerEvents-none, reads `getEquippedLook`, renders `Mascot` by `pose`, Reanimated edge slide-in on focus,
  reduced-motion aware). Mounted on Home (intro→idle via `useFocusEffect`) and on all 3 live Results screens
  (wheel/ladder/drop) where each game classifies its own outcome → cheer|dismay. Grid/Poll are retired (no
  reachable Results). No in-play host, no text quips (deferred). tsc clean, eslint 0 errors (2 pre-existing
  warnings), new file prettier-clean, i18n:check ✅. AWAITING USER REVIEW before commit. NEXT (after approval):
  commit, then Phase 6 (real art — swap placeholder primitives for the multi-region SVG fox).
- 2026-06-30: Phase 6 BUILT (real art). Hand-authored multi-region SVG fox host replaces the placeholder
  primitives in `Mascot.tsx` — same 4 recolorable regions (fur/suit/accent/mic) + SHADE/HILITE overlays
  (§2 seam intact), same `MASCOT_VIEWBOX` bounds, single-shape + existing transforms (no per-pose variants).
  New `MASCOT_NODE_CEILING = 40`; art draws 30 nodes (Phase 0 ~24 smooth). `HIT_ZONES` re-fitted in
  `MascotScreen`. Deleted orphaned `poc/` folder + fixed its `look.ts` doc ref. tsc/eslint/prettier/i18n all
  clean. NEEDS DEVICE LOOK to judge aesthetics + confirm tap-on-fox (re-verify Home, 3 Results, customizer).
  AWAITING USER REVIEW before commit. With polished art in place, the §8 final palette can be locked →
  unblocks Phase 7 (IAP provisioning).
- 2026-07-01: Phase 6 REFINEMENT (arms/hands/mic, user feedback ×4). Curved the two stiff straight forearms
  into bent-elbow `C` paths; re-seated the arms shoulder→paw (inside the jacket silhouette); removed the stray
  left-edge jacket-shadow sliver; nudged the mic assembly +10 right/+5 down so it clears the smile (paws +9/+3
  + creases to keep cupping it); re-fitted the mic `HIT_ZONES` rect. Device-verified on iPhone 16e sim — full
  smile now visible, arms read relaxed, no stray shadow. tsc/eslint/prettier/i18n all clean. AWAITING USER
  REVIEW before commit.
- 2026-07-01: Phase 7 STARTED. User revised plan to sell costumes independently instead of a single bundle.
  Split `com.showdown.mascot_skinpack` into `com.showdown.mascot_arctic`, `com.showdown.mascot_emerald`,
  and `com.showdown.mascot_plum` (~$0.99 each). Final palette confirmed (keeping existing placeholder colors).
  Code + i18n updated. Proceeding to provisioning.
- 2026-07-01: Phase 7 COMPLETED. IAPs provisioned in both stores (App Store Connect and Google Play) as drafts.
  User tested the flow on-device. Based on user feedback: updated MascotScreen to navigate to the Store's
  Mascots tab and auto-open the selected costume's modal instead of silent purchase. Temporarily added and
  subsequently removed a DEV ONLY "Clear Mock Purchases" button in Settings to aid testing. Mascot build is now complete!
