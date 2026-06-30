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
> Continue the Showdown mascot build, Phase 2. Read both mascot docs. Build the customizer
> screen that replaces `MascotPocScreen` behind the `Mascot` route: full-screen live fox,
> tap-region OR slot-button → bottom sheet of that slot's colors (REUSE
> `src/components/molecules/BottomSheet.tsx`), mascot scales down/translates up when the sheet
> opens, live recolor on select + immediate persistence, unlocked-first then locked-with-badge
> ordering, plus a few preset looks. Save progress after each step; stop for review before committing.

**Phase 3 — store / billing integration:**
> Continue the Showdown mascot build, Phase 3. Read both mascot docs. Wire the buy path: a
> locked purchasable swatch routes through the EXISTING react-native-iap + `MMKVPurchaseAdapter`
> plumbing to buy `com.showdown.mascot_skinpack` (do NOT rebuild billing), and surface the pack
> in the standalone store screen for discovery. Save progress after each step; stop for review
> before committing.

**Phase 4 — progression deep-link (scroll-to-anchor):**
> Continue the Showdown mascot build, Phase 4. Read both mascot docs. Add earned mascot elements
> in `src/game/progression/` (never sold); make a locked EARNED swatch navigate to the progression
> map and highlight the target level. The `Progress` route already takes `{ focusRewardId }` —
> check `ProgressScreen` for existing anchor/highlight wiring and extend it to scroll-to + highlight.
> Save progress after each step; stop for review before committing.

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

## Phase 2 — Customizer UI (§5)
- [ ] Full-screen live fox; tap region OR slot button opens bottom sheet.
- [ ] Custom slide-up sheet on gesture-handler + reanimated (no lib).
- [ ] Mascot scales down / translates up when sheet opens.
- [ ] Live recolor on select; persist immediately; unlocked-first then locked w/ badge.
- [ ] Preset looks shortcuts.

## Phase 3 — Store / billing integration (§5)
- [ ] Buy path: locked purchasable swatch → shared billing engine (react-native-iap +
      MMKVPurchaseAdapter) → bundle. Do NOT rebuild billing.
- [ ] Standalone store screen entry for discovery.

## Phase 4 — Progression deep-link, scroll-to-anchor (§5, §8 — pulled into v1)
- [ ] Earned mascot elements in `src/game/progression/` (never sold).
- [ ] Locked earned swatch → navigate to progression map, highlight target level.
- [ ] Anchor-scroll + highlight in `ProgressScreen`/`GameSetupScreen`.

## Phase 5 — Placement (§4)
- [ ] Self-contained overlay component, slid in via Reanimated transform.
- [ ] Home screen: intro/idle, shows equipped skin.
- [ ] Results screens: each game classifies outcome → `cheer|dismay`, tells mascot.

## Phase 6 — Real art (§2, after PoC perf budget set)
- [ ] AI concept raster → hand-cleaned multi-region SVG, same fox across 4 poses.
- [ ] Apply node ceiling from Phase 0 perf data.

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
