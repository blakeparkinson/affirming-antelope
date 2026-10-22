# Affirming Antelope mobile: design system

Read this before you build a screen. It covers the system the drill, role-play, reflection and debrief screens should extend. Brand source of truth: `/BRAND.md`.

## Principles

- **One primary action per screen.** It's a cobalt `Button` (ALL CAPS, short: START, CONTINUE, SUBMIT). Everything else is secondary (white, sentence case) or a quiet link.
- **Raised, not shadowed.** Surfaces sit on a solid 4 to 6pt bottom shadow in the darker related token. Pressed controls lose the shadow and move down. Never use blurred drop shadows, gradients, or glass.
- **Cobalt means learning, ochre means achievement.** Ochre (`gold`) is for checks, streaks, completed levels, and celebration. It is never a CTA colour.
- **Sentence case everywhere.** ALL CAPS only for short primary button labels (the Button component handles this).
- **The mascot shows up only when it has something to say:** guidance, encouragement, completion, or an empty state. It isn't decoration.
- **Coach voice:** direct, specific, encouraging. "One short drill." not "Supercharge your skills!"

## Tokens: `src/design/tokens.ts`

| Token | Use |
|---|---|
| `color.primary` #4F6BED / `primaryShadow` #374FBF | actions, active states / pressed + bottom shadow of cobalt |
| `color.onPrimaryMuted` #DCE2FF / `onPrimaryBody` #FFFFFF / `onPrimaryChip` #6A82F0 | overlines, body copy and chip faces on a cobalt surface (never `rgba(255,255,255,…)`) |
| `color.gold` #E8A638 / `goldShadow` #B97914 / `goldTint` | achievement only. Glyphs on ochre are **navy** (`tone.gold.ink`): white on ochre is 2.1:1 |
| `color.goldInk` #8A5A0B | text and glyphs on `goldTint` or white (a gold chip's label, "Done", the seal check). Never hard-code the hex |
| `color.soft` #EEF1FF, `softDeep` | learning surfaces, selected states, tracks |
| `color.line` #DFE3F2 / `shadow` #CBD1E5 | 2pt borders / bottom shadow of white surfaces |
| `color.rule` (= `soft`) | dividers *inside* a card (list rows, the explain rule, the feedback actions). Chrome rules (dock, tab bar, compact bar) keep `line` |
| `color.ink` / `muted` / `faint` | body text / secondary text (also placeholders: `faint` is 2.2:1) / locked glyphs only (not text you need to read) |
| `color.navy` | illustration contours, rare dark surfaces (Challenge me card, tooltips) |
| `space[1..10]` | 4pt grid. Screen gutter is `layout.gutter` (20) |
| `radius.surface` 20, `radius.illustration` 32, `radius.md` 16 (buttons), `radius.lg` 24 | |
| `radius.badge` 12 | step badges, chips, the tab pill, small icon boxes. No other off-scale radii |
| `depth.sm/md/lg/xl` 3/4/5/6 | bottom shadow: learner bubble, choice tiles, bubbles + standard surfaces + large buttons, hero cards |
| `moveColor.*` | learner-move families: `question` cobalt, `reflection` teal, `support` navy, `inconsistent` terracotta, `neutral` faint. Always paired with a shape (`MoveMarker`) |
| `zone.*` | replay-chart bands: `change` (soft), `mixed` (white), `hold` (warm sand) + `holdInk` |
| `tone.*` | `{face, border, shadow, ink}` sets: primary, surface, soft, gold, navy, onPrimary, locked |
| `type.*` | hero/title/heading/subheading/number = Fredoka. body/bodyStrong/bodySmall/bodySmallStrong/label/caption/captionStrong/overline/tabLabel/button/buttonSentence = Nunito. Never override `fontFamily` or size on a `Text`: add a variant |

## Components: `src/design` (import from `@/design`)

- `Text`: the only text component. `variant`, `color`, `align`. It caps Dynamic Type for each variant, so layouts don't break.
- `PressableSurface`: the 3D press primitive. `tone`, `depth`, `radius`, `haptic` ('press' | 'tick' | false), `pressScale`, `contentStyle` (the face). `Raised` is the static version.
- `Button`: `variant` primary | secondary | onPrimary (white on a cobalt card), `size` lg/md/sm, optional `icon`. Hit targets are at least 44pt.
- `Card`: a raised surface. Pass `onPress` to make it pressable. **Never nest a Button inside a pressable Card** (on web that renders a button inside a button).
- `Chip`: non-interactive label (soft, primary, gold, neutral, locked, onPrimary). `icon` leads the label (the drill's level chip carries `LevelPips`).
- `StepBadge`: the 32pt step marker. `shape` `square` | `pill`; `state` `level` (numeral, Home) | `done` / `target` (navy check on ochre) | `locked` | `letter` (choice) | `selected`. The root is an `Animated.View`: pass an animated `style` for pops; `glyph` replaces the state's glyph; `size` is 32 except dense rows (the assignment check is 24).
- `Bubble`: the one speech-bubble surface. `side` `learner` (depth.sm, tail bottom right) | `other` (depth.lg, tail bottom left) | `coach` (like other, fills the row); `compact`; `tail={false}` for a card-sized line (the drill's speech card). It's an `Animated.View` that forwards its ref and every animation prop (`layout`, `entering`, `exiting`, animated `style`).
- `Callout`: soft inset inside a card or sheet (no edge, no depth): optional `glyph` (leading column), `overline` (+ `overlineIcon`), `dense`, `overlay` (decoration pinned to its box, e.g. the "Try next" cue edge). Trainer note, task, possible response and "Try next" are all Callouts.
- `ListRow`: a pressable row of at least 56pt, ruled with `color.rule`, with the press squeeze built in. `contentStyle` takes an animated style for the row's own give.
- `TextLink`: quiet cobalt action, 44pt tall (`caret` when it navigates, `entering` to tick its label over). `SectionHeader` actions and the drill's "I'm done" are TextLinks. `SectionHeader` with `action` but no `onAction` shows a muted note instead.
- `IconButton`: flat icon control with a 44pt hit target and a press squeeze (the close X).
- `ProgressBar`: segmented track (`fills` 0..1 per segment). It shares `Pip` with `LevelPips`: same track, settle spring and 45ms stagger. It starts settled, so only a change animates; reduced motion cross-fades the changing segment.
- `Pip`: one track + fill; the shared element of `LevelPips` and `ProgressBar`.
- `ProgressRing`: SVG ring that springs to `value` (0..1). `onFilled` fires once on landing (pair it with `haptic.success`).
- `LevelPips`: six-step skill level (`level`, `percent`, `state` progress/complete/locked). The pips fill on a 45ms stagger. Skills are shown as levels, never as percentages (Home's progress rows say "Next: Respond").
- `BottomSheet`: gesture-driven modal. Drag down or flick to dismiss, drag up to rubber-band, and the backdrop dims with position. `open` / `onClose`. Keep content short (the sheet doesn't scroll).
- `SegmentedControl`: raised white thumb that slides on a periwinkle track. Segments take a `hint` second line.
- `Switch`, `Avatar` (deterministic from `persona.avatarSeed`, flat with the navy contour, same seed gives the same person), `Hoofprint` (the streak and track motif; antelopes leave tracks, not flames), `Screen` (safe area plus tab-bar padding).
- Icons: Phosphor, re-exported from `@/design/icons`. Use `weight="bold"` for UI and `"fill"` for active. Never emoji.
- `haptic.tick | press | thud | success | warn`. Fire it on the visual peak (press-in, snap, landing), never on a timer. It respects the Me > Haptics setting and does nothing on web.

## Motion: `src/motion`

- Springs (`spring.*`): **snappy** (press-in, toggles, indicators), **release** (spring back with a little overshoot), **gentle** (entrances, sheets), **bouncy** (celebration, icon pops, hops), **settle** (rings, precise stops). Prefer springs over timed easing. Use `withTiming` only for authored loops (breathing, pulse) and cross-fades.
- `useEntrance({ index, delay, from })` / `<Enter index={n}>`: staggered (`STAGGER` = 45ms) rise-in. Under reduced motion it becomes a 180ms fade.
- `RollingNumber`: odometer counter. Digits land right to left.
- `usePressScale()`: press feedback for flat rows and icons.
- `useReduceMotion()`: OS setting OR Me > Reduce motion. **Every new animation must have a reduced path**: same end state, no travel, cross-fade at most.
- Run everything on the UI thread (shared values, `useAnimatedStyle` / `useAnimatedProps`). JS-thread animation loops aren't allowed. Read shared values directly inside each worklet, or through `useDerivedValue`. Reanimated web doesn't pick up shared values that are read through a nested worklet helper (see `components/path/Trail.tsx`).
- Use `scheduleOnRN` from `react-native-worklets` (not `runOnJS`) to call back into React.

## Motion system (transitions, choreography, rules)

Reference captures: `docs/motion/*.gif`.

### Primitives (`src/motion`)

- `layout.ts`: `useListLayout()` (LinearTransition spring for siblings making room), `useFades()`, `useTickSwap()` (a value ticks over: new content rises in, old lifts away), `useForwardSwap()` (next in a sequence: out left, in from the right). Always use these hooks instead of raw Reanimated builders: they respect Me > Reduce motion (raw builders only follow the OS setting) and stick to predefined builders, so they also run on web.
- `Expand`: animated auto-height. Content is measured off-flow and the container springs its real layout height, so everything below moves on the same frame. Use it for anything that opens in place (MC explanations, the coach's reaction, error cards).
- `Burst`: UI-thread particles. One shared clock, closed-form motion under gravity and drag, no per-frame JS. Fire it on the visual peak, on the same frame as the haptic. Renders nothing under reduced motion.
- `launch.ts` + `components/practice-loop/SessionSurface.tsx`: continuity transitions (below).
- `components/roleplay/TypeIn.tsx`: the coach's words type in line by line behind a curtain in the bubble colour, with a cobalt caret. The paragraph is laid out once at final size, so nothing grows or jumps. Web and reduced motion get a fade.

### Continuity transitions

Shared element transitions in Reanimated 4.5 sit behind the `ENABLE_SHARED_ELEMENT_TRANSITIONS` static flag, which needs a package.json flag plus a native rebuild and is still experimental with the native stack. We use a hero overlay instead, and it runs everywhere, Expo Go and web included:

1. A source calls `launchFrom({ container, title?, cta?, face, radius, depth })`. It measures the card, its title and its button, registers a `Launch`, then navigates.
2. The practice screen is a `transparentModal` with `animation: 'none'`, so the source stays mounted and visible underneath.
3. `SessionSurface` takes the launch once. It grows a window from the source rect to full screen and keeps the content fixed in screen space, so the window reveals it. The source's face colour fades out, the title flies to `<HeroTarget name="title">`, and the CTA surface morphs into `<HeroTarget name="cta">`. On close it re-measures the source and collapses back into it.

| Source → destination | Title lands in | CTA becomes |
|---|---|---|
| Home daily rep card → drill | drill header | the speech card (white button → white card) |
| Practice skill tile → drill / role-play brief | header | role-play: the brief's START CONVERSATION |
| Path node → unit sheet | (BottomSheet `origin`) | sheet grows out of the node; node scales 1.08 and glows. On close it heads back and is transparent before it nears the labels; a thin ring ripples out of the node as it lands |
| Brief portrait → conversation header | (AvatarFlight, inside the role-play) | |

Timelines, measured on the simulator:

```
Hero open (OPEN spring d18 k80, ζ=1: ≈75% at 300ms, ≈91% at 450ms)
  0ms      the window IS the card (rect, radius, face colour), opaque from frame one; proxies sit exactly
           on the source's title and START, so nothing doubles or pops
  0-450    window grows from the card's rect on all sides; radius → 0; Home dims (navy backdrop to 34%)
  30-320   face colour → white; flying title white → ink
  140-370  destination content fades in (its own staggered entrances already running)
  190-330  title hands off to the header mid-flight (large-title style, no overlap)
  230-420  the CTA's target fills in under the arriving surface (no empty skeleton)
Hero close (CLOSE spring d32 k340): the window shrinks onto the re-measured source; content stays
  visible until ~45% so you watch it close; the face fades back in; the last 10% fades out over the real card.
No source: rises from the bottom (sheet semantics). Replace (practice → practice): forward swap.
Swipe down on the header: follows the finger 1:1, scale ≥ 0.9, radius → 32, backdrop lightens;
  tick at 120pt (point of no return); release past it or flick (> 900pt/s) → exit carries the velocity.
Brief → conversation ("walking into the meeting")
  0-240    brief scales up 6%, drifts up, fades (ease-in: you step through it)
  60-420   conversation comes into focus from 96%
  0-460    portrait flies to its header seat (y spring stiffer than x, so it arcs)
  ~400     the opening line rises in once you've sat down
```

### Content changes

- Chat: your bubble launches out of the composer. It starts on the field (left and bottom edges aligned), and the field's text hides that frame. The thread is one keyed list, so the employee's typing dots and their finished reply are the same element. Its frame springs as words stream in, and the text is clipped to the growing frame, so it grows and never jumps. The header status ticks over.
- Drill: "One more" uses the forward swap (old rep out left, new rep in from the right). The composer drops away as the words lift out. MC explanations and the coach's reaction open with `Expand`. The feedback panel animates out (`open={false}` → `onExited`) before the rep resets.
- Role-play phases stack absolutely, so an exiting phase never holds layout space.

### Choreographed payoffs (storyboards live in the code comments)

- **Debrief reveal** (`Debrief.tsx`), first visit only (`played` WeakSet); later visits are settled. The coach types in → the compact ticks land → +700ms, each section plays as it scrolls ≥ 80pt into view. The chart traces and markers pop as the line reaches them, with a light haptic on key moments. Tallies roll on a 70ms stagger, then the beam tips (one tick at its first peak). Strengths cascade 80ms apart.
- **Completion** (`Completion.tsx`): the hoofprint stamp drops, squashes on contact (thud + small burst), the streak rolls and the ring advances with a glow. When the weekly goal completes: an ochre ring with a check, a big burst, a second glow, the "Weekly goal hit" chip and a mascot hop. That's the only success haptic in the sequence. Buttons are usable within about 600ms.
- **Drill tones** (`FeedbackPanel`, `ChoiceTiles`): a target hit is warm (livelier rise, chip pops with the seal rotating in, burst, hop, success haptic). "Worth another pass" is gentle (soft rise, the coach leans in to listen, a tick at most, the "Try next" bulb lights once). Never shakes, red or X marks on a learner's attempt.
- **Path unlock** (`path.tsx`): triggered when `currentWeek > pathSeenWeek`. The trail draws, the previous node checks, the lock breaks (small burst), the new node pops (success), and the mascot hops out at the old week and drops in beside the new one (it never crosses a label). Dev replay: Me › Demo › Replay path unlock.

### Scroll and tabs

- Home: the big greeting fades, scales and drifts with parallax as the compact sticky title rises in (a clear handoff; at no point are both fully visible, or neither).
- Path: depth-based parallax (lag capped so no gaps open). The "Week N" pill appears only when the current node is off screen and smooth-scrolls it back to centre.
- The tab bar's white and top rule run edge to edge, but its tabs keep to `layout.maxWidth` (520), so on a wide screen they sit under the content column.
- Tab icons each have their own gesture: Home squashes onto its base, Path takes two steps along its curve, Practice punches in with one ring ripple, Me nods. Bold → fill cross-fades in 160ms.

### Do

- Use springs for anything interruptible. A new target retargets from the current value, so rapid taps never queue.
- Run every animation on the UI thread. Never capture objects that hold native refs in a worklet (copy primitives out first; `launch` is the cautionary tale), and schedule plain JS functions with `scheduleOnRN` (not `Keyboard.dismiss` directly).
- Give every new animation a reduced path: same end state, cross-fade at most.
- Fire a haptic on its visual peak (use a reaction or a spring callback), one per beat. Ochre and bursts are for achievement only.
- Keep durations tight. Motion should explain where something came from or went; nothing should make the learner wait.

### Don't

- Don't call `router.back()` from a practice screen (use `useSessionClose()`).
- Don't animate the same thing twice. A heroed target skips its own entrance (`useSession()?.hasPiece('cta')`).
- Don't let an exiting element hold layout space. Stack exiting and entering content absolutely.
- Don't let raised faces (`flexGrow: 1`) sit in a header's trailing slot without `flexGrow: 0` on the content style; they stretch to the full screen height.
- Don't trust `TextInput` `onContentSizeChange` for auto-grow on this RN version (it reports the frame and feeds back on itself). Composer measures a hidden text mirror instead.

## Mascot: `src/components/mascot`

```tsx
<Mascot pose="wave" | "celebrate" | "head" mood="idle" | "listening" | "thinking" | "cheer" size={120}
        greet paused={!isFocused} flip ref={handle} />
handle.current?.wave() | hop() | turn() | nod() | cheer()
```

- `size` is the height in pt of the pose's drawing. `greet` waves once after mount. Changing `pose` squashes, swaps at the bottom of the squash, then stretches and settles. Pass `paused={!useIsFocused()}` from screens; the mascot also pauses when the app is backgrounded. Reduced motion keeps blinks, nods, breathing and moods but skips wave/hop/cheer, the cheer mood's hops and the idle drift (head, ears, tail, scarf, arms).
- Suggested use: drill feedback `head`/`listening`, a correct answer `hop()`, an approving beat `nod()`, the coach working something out `thinking`, debrief completion `celebrate`/`cheer`.
- **Two implementations behind one API** (`index.ts`). `RiveMascot` (Rive file `assets/rive/mascot-coach.riv`) on native builds that link the Rive runtime; `MascotSprite` (layered PNGs, `assets/mascot/rig/`, from `scripts/build-mascot-rig.py`) on Expo Go, Expo web, and whenever the Rive file fails to load. The choice is a capability check (`riveAvailable.ts`: platform, Expo Go, Nitro hybrid objects), never a try-and-see; `RiveMascot` is `require`d only when it passes. The sprite also covers the first frames while the Rive file loads.
- **Rive layout.** One artboard, `Coach` (820x1140), holds both drawings. `coach.generated.ts` gives each pose's drawing rect on it; `RiveMascot` sizes the canvas so that rect is the layout box and lets the canvas overhang it (hops and ears never clip). The head pose shows the wave drawing cropped below the face, open above for hops.
- **Source of truth.** Art: `apps/web/scripts/mascot-coach-layers.py` cuts the approved stills (`apps/web/public/brand-mascot-{wave,celebrate}-cartoon.png`) into layers with hidden fills, joint caps and an eye rig (`apps/web/public/mascot-layers/coach/`). Animation and state machine: `apps/web/scripts/mascot-coach-build.mjs` writes the `.riv`, `coach.generated.ts` and `mascot-coach.scene.json`. Test headlessly with `node scripts/rive-harness.mjs <riv> <script.json> [framesDir]` (all from `apps/web`). Don't hand-edit the outputs.

### State machine contract (`Coach` state machine, view model `Coach`)

The app drives it through data binding: `RiveView dataBind={instance}` with the file's default view-model instance. (SMI inputs throw on the default iOS runtime, so there are none.)

| View-model property | Type | Meaning |
| --- | --- | --- |
| `pose` | number | `0` wave drawing, `1` celebrate drawing, `2` head (wave drawing, raised arm hidden; the app crops). Instant swap; the app squashes around it. |
| `mood` | number | `0` idle, `1` listening (head tilts toward the text, ears perk with overshoot, eyes up-right, slight lean in, "mm-hm" bob), `2` thinking (tilts the other way, eyes up-left drifting, one ear back), `3` cheer (a happy hop with squint every 2.4 s). Moods ease in with an anticipation one-shot and mix out over 420 ms. |
| `wave` | trigger | Anticipation toward the face, then 2.5 outward swings; elbow and hoof lag the shoulder; head leans in, ears flick, a small "hi!" bounce. Celebrate pose: the raised arm waves. Head pose: head and ears only. |
| `hop` | trigger | Anticipation squash, launch stretch, apex, landing squash, rebound, settle (1.33 s). Volume-preserving squash; the head keeps most of its shape; ears, tail and scarf follow through. |
| `cheer` | trigger | A bigger hop with arms up and a happy squint. From the wave pose the drawing swaps to the celebrate drawing at the bottom of the squash and back at landing; head and celebrate poses hop in place. |
| `nod` | trigger | Head dips twice (foreshortened), ears lag, a contented half-squint. |
| `still` | number | `1` while reduced motion is on: the Idle layer mixes (300 ms) to breathing only and the drifting nodes hold their rest. `0` restores the full idle loop. |
| `blink` | trigger | Blink now. Blinks also run by themselves on an irregular 2.9 / 4.3 / 1.7 / 5.4 s chain with one double blink. |

Layers, back to front: **Pose** (drawing visibility), **Idle** (6.4 s loop: breath at the feet, head/ears/scarf/tail/arm drift with lag, an ear flick and tail swishes off the beat; breathing only when `still` is 1), **Mood**, **Blink**, **Action** (one-shots return to rest on their own). Each layer keys its own node in a nested chain (`wHead > wHeadMood > wHeadAct > wHeadIdle`, same for ears, tail, scarf, arms, and `wHop > wHopSquash > wHopBreath > wHopLean` at the feet; `c*` for the celebrate drawing), so motion from different layers adds up instead of fighting. Authored at 60 fps.

## State: `src/state/store.ts` (zustand, persisted to AsyncStorage)

A new install starts as a **fresh learner** (`freshLearnerState` in `@antelope/core`, via `state/learnerDoc.ts › freshSeed`): week 1, no streak, no name, no trainer assignment. Amanda (`DEMO_LEARNER`) is reachable only from Me › Demo › **Demo learner** in dev builds (`setDemo`; the `demo` flag is device-only and never synced). The device is the source of truth for practice state; it works fully offline and signed out.

**Multi-pathway shape (store v3).** `activePathwayId` + `pathwayChosenAt` (null until the welcome's track step) and `progress[pathwayId] = { currentWeek, completedActivityIds, pathSeenWeek }`. Streak, weekly goal, skill levels and counts stay global. `completeActivity` finds the pathway that owns the activity (ids are unique across pathways), so a lesson from the other track advances that track. `choosePathway(id, source)` switches without touching the other track's progress and sends `pathway_chosen`. Read progress through the selectors (`useActivePathway`, `useSetting`, `useProgress`, `useCurrentWeek`, `useCompletedActivityIds`, `weekLabel`, `pathwaySkills`), never `MI_FOR_LEADERS`; content goes through `data/pathways.ts` (`getPathway`, `drillsForSetting`, `scenariosForSetting`, `dailyDrillOrder`, `pathwayForSetting`, `trackName`).

**Migration (persist v2 → v3, `learnerDoc.ts › upgradeDoc`, also applied to every `learner_state` read).** An untouched v2 demo seed (Amanda's name, 17-day streak with no practice day, week 4) becomes a fresh learner with no track chosen, so the welcome opens at the track step. Any other v2 state keeps its progress under its `pathwayId` (track counts as chosen) but drops the demo identity (name, sample assignment). Pushes add the v2 fields mirrored from MI for Leaders (`toRemoteDoc`) so older app versions still read their course; the merge unions per-pathway progress (max week, union of activities) and keeps the most recent track pick.

Actions for the practice loop:

- `recordPractice({ kind, skill?, refId?, activityId?, minutes })` updates the streak, weekly goal, skill progress and assignment items. When `activityId` is set it also calls `completeActivity`, which advances the path week once every activity in the unit is done. Every record gets a uuid `id` (its `client_id` on the server) and the signed-in user as `ownerId` (unset in guest mode).
- `recordSession({ kind, refId, skill, transcript, debrief, selfReflection?, startedAt, endedAt, durationSec })`: every drill rep and finished role-play is kept as a practice session (what trainer review shares).
- `completeActivity(activityId)`, `claimRecords`, `applySynced` (sync only).
- `SYNCED_KEYS` / `syncedState()`: the slice mirrored to `learner_state` (track, per-pathway progress, streak, freeze ledger, goal; not settings, the demo flag or practice history).
- Selectors: `useCurrentUnit`, `nextActivity`, `useProgressRows` (`state/selectors.ts`). Process rows and "Opens in week N" come from the active pathway's units.

`src/state/account.ts` (`useAccount`, persisted cache): auth status, profile, cohorts (with trainer names), assignments with progress, submissions, reviews, `onboarded`. The server owns all of it; `sync/cloud.ts` refreshes it. `RATING` maps a review's level to words, `personSeed(name)` gives people a stable avatar (Dr. Rosa Lin keeps the demo face).

## Accounts, sync, cohorts, trainer review

Guest mode is the default and loses nothing: everything above runs on the device. Signing in adds sync, cohorts, assignments and trainer review. Sign-in prompts appear only where signing in unlocks something: joining a cohort (Home's "Practicing with a trainer?" card for guests) and sending a role-play for review (the review sheet). Me › Account is the general way in.

### Sync engine: `src/sync/`

- `lib/supabase.ts`: the client (AsyncStorage session, auto refresh started/stopped with AppState), env + LAN-host default, `isTransient()` error triage, and the dev **Simulate offline** switch (every request fails like a dropped connection).
- `outbox.ts`: persisted, ordered, per-user queue (`completion`, `session`, `submission`, `withdraw`, `seen`). Idempotent writes (client ids + ignore-duplicates), batched, exponential backoff 2s → 5 min with jitter on transient failures; permanent failures are dropped and logged so one bad row can't block the queue.
- `learnerState.ts`: versioned `learner_state`. Each write sends last-seen version + 1; on PT409 it refetches, merges field by field (`mergeSynced`: union of completed activities, max of week/levels/counts, the later streak) and writes server version + 1. On sign-in, a device with no guest practice adopts the account's state; one with guest practice merges it in.
- `engine.ts`: auth transitions (guest migration on sign-in; sign-out flushes, then `resetDevice` wipes the learner store, outbox, account cache, welcome and analytics identity so the next person starts clean; `flushBeforeSignOut` tells the confirm sheet whether anything is still unsynced), store subscriptions (new practice → outbox, synced edits → dirty), flush on enqueue / foreground / reconnect (expo-network) / backoff timer, refresh on sign-in / foreground / pull-to-refresh / Realtime `reviews` and `submissions` events. A submission insert that hits 23505 (a retry, or the session is already shared from another device) counts as submitted; the refresh then swaps the optimistic row for the server's and the review screen follows it. Learner actions: `submitForReview`, `withdrawSubmission`, `markReviewSeen`, `syncNow`.
- `cloud.ts`: reads (profile, cohorts, assignments + `assignment_progress`, submissions with their review) and the direct actions that need an answer now: `joinCohort` (normalises "mil demo" / "MIL-DEMO" / "DEMO"), `leaveCohort`, `renameSelf`, `reviewAudioUrl` (signed URL).
- `auth.ts`: email one-time code (`sendCode`, `verifyCode`, `signOut`: flush, local sign-out, then `resetDevice` wipes the device and a clean guest starts).

### Screens

| Route | What it is |
|---|---|
| `welcome` | First launch, two steps. **Intro:** mascot on a soft hill, three lines on what the app does, TRY IT FIRST (guest) or Sign in (sign-in returns here via `flowEvents`). **Track:** "What conversations do you want to practice?", two `TrackCard`s (Patients / MI for Clinicians, Your team / MI for Leaders; tagline and audience from core), CONTINUE disabled until one is picked. Never skipped: `lib/launchHint.ts` preselects from the launch URL (`src=audience_clinicians` / `for_clinicians` / leaders likewise, or a guide's deep-linked drill's setting); a signed-in account's track is preselected too. Installs that still need a track (an old demo seed reset to fresh) open at this step. Root guard: `onboarded && pathwayChosenAt`. Behind `Stack.Protected` so it hands over to Home with a fade. |
| `sign-in?reason=welcome\|cohort\|review\|me` | Sheet. Email → 6-digit code → your name (only while `profiles.display_name_set` is false), with three step bars. The head-pose coach listens while you type, thinks while the code is checked, hops on success. `cohort` continues to Join. |
| `join` | Sheet. Fixed "MIL –" prefix and four cells; a complete code joins at once. Success: the ochre seal pops with a burst and the success haptic, then the cohort card (trainer, what's waiting). |
| `review/[id]` | One submission: waiting (withdraw via `ConfirmSheet`), withdrawn (Share it again: a new submission, the withdrawn one stays as history), or the trainer's feedback (rating in words, notes in a coach bubble, voice note, recommended practice as the docked START, Try again). Opening it sets `learner_seen_at`. Pull to refresh. |

Home: the inbox card (`FeedbackCard`) sits under the daily rep when a review is unseen. "From your trainer" shows real assignments (`data/assignments.ts` maps DB items to rows: `any-drill` + skill opens a drill of that skill at your level, `roleplay` opens the scenario; progress is the server's count topped up by unsynced practice on the phone), `JoinCohortCard` when signed in without a cohort, `GuestJoinCard` for guests (no sample assignment; the demo learner alone keeps Dr. Rosa Lin's), `NothingAssigned`, or the sample assignment + `GuestCohortPrompt` for guests. Me: profile (signed in), "From your trainer" list (`TrainerInbox`), "Your trainer", `AccountSection` (email, rename sheet, cohorts with Leave, join, sync status, sign out).

The review sheet (`roleplay/ReviewSheet.tsx`) gates on the account: guest → sign in, no cohort → join, several cohorts → a trainer picker, else note + SEND. Sign-in and join are full screens, so the sheet steps aside and the debrief reopens it when the flow closes (`lib/flowEvents.ts`) and the step actually happened. Sent shows the real state ("Sent to Dr. Rosa Lin", "Saved. It'll send soon" offline, "Reviewed by …").

### Components

- `account/CodeInput`: segmented code cells over one invisible `TextInput` (iOS `oneTimeCode` autofill, Android `sms-otp`, paste of "123 456" or "MIL-DEMO", a hand-typed "MIL" is swallowed). A typed character pops in (bouncy + tick); the active cell has a blinking cobalt caret; `busy` runs a crest across the cells; `error` is a system notice, so it's the one place that shakes (one decaying shake + warn haptic, warm `notice` cells) and the next keystroke starts a fresh code; `success` fills the cells cobalt left to right and lands on the success haptic. Reduced motion: no pops, crest or shake; colours cross-fade.
- `KeyboardColumn` (practice-loop): pads by the keyboard's overlap with the column measured in window coordinates, on the keyboard's own curve. Not `KeyboardAvoidingView`, which measures relative to its parent and left the drill composer (below a header) under the iOS 27 suggestion bar. On the web (`webKeyboard.ts`) Safari overlays the keyboard and scrolls the whole page to reveal the field, which pushed the header and prompt off the top and showed a grey band. So practice screens pin the document at the top, keep the session at the layout viewport's height, tap-focus the composer with `preventScroll` (iOS), and pad the column by the keyboard's overlap with the visual viewport (rAF-throttled, on a keyboard-like 250ms curve; on blur it starts down with the keyboard rather than waiting for Safari's late resize). The export's viewport meta adds `interactive-widget=resizes-content` for browsers that honour it. Composer regressions on the web are caught by `e2e/composer.spec.ts` (Playwright, WebKit + Chromium, iPhone touch emulation, offline), and Talk mode by `e2e/voice.spec.ts` (Chromium): `npm run build:web && npm run e2e`.
- `account/FlowChrome`: `FlowHeader` (close or back, centre slot), `TextField` (2pt edge, raised 3pt, cobalt focus ring cross-fades, `invalid` turns it `notice`), `Notice` (warning icon + copy, opens with `Expand`).
- `review/VoiceNote`: cobalt play button and a waveform scrubber. The cobalt copy of the bars is clipped to the playhead (one animated width on the UI thread) and glides linearly between the player's 250ms status ticks; drag or tap to scrub (tick on touch, knob swells), seeks on release; plays through the silent switch; adjustable for VoiceOver (±5s).
- `home/TrainerCards`: `FeedbackCard` (cobalt-edged raised card; the "New" pip pops after the card rises, breathes twice, rests), `JoinCohortCard`, `NothingAssigned`, `GuestCohortPrompt`.
- Tokens: `color.notice` / `noticeTint` for system notices (a code that didn't work). Warm, never red, never on a learner's practice.

Captures: `docs/screens/accounts-*.jpg`.

### Copy rules

- Ratings are words with a line of meaning ("Developing: It's there in places. The next step is doing it on purpose."). Never a number, a bar or stars.
- Say what's shared and what isn't, every time. Withdraw is always possible while a session is waiting.
- Offline is normal: "Saved on this phone. Sends when you're online." Never an error for practice that's safely queued.
- No pronouns for trainers in system copy (names only).

## Practice-loop routes: `src/data/routes.ts`

`openDrill(id, {activityId?, minutes?, source, replace?})`, `openRoleplay(scenarioId, …)`, `openLesson(id, {activityId?, minutes?, replace?})`, `openActivity(pathActivity, source, {replace?})`, `pickDrill(skill, level)`, `pickScenario(skill)`, `findActivity(activityId)`, `nextDrillId(current, done, activityId?)`. Use `replace: true` when one practice screen leads to another (debrief "Try a harder scenario", lesson "Start next") so Close still returns to where the learner started. The three practice screens are transparent modals over the tabs with no native animation; `SessionSurface` owns their transitions (see Motion system). Close X top left, one primary action docked at the bottom. Leave with `useSessionClose()`, never `router.back()`, so the exit animates. `go()` ignores a second launch within 650ms, so double taps never stack screens.

## Practice loop: `src/components/practice-loop` (shared)

- `SessionHeader` (close X + centre + trailing slot, safe top), `Dock` (bottom bar above the home indicator), `KeyboardColumn` (window-measured keyboard padding on iOS/Android, visual-viewport padding on web; Expo Go safe, no keyboard-controller), `sessionStyles`.
- `Speech` (all built on `Bubble` / `Callout`; animations stay on the callers' wrappers): `LearnerBubble` (cobalt, tail bottom right), `EmployeeBubble` (white raised, persona `Avatar`, tail bottom left; children replace text, e.g. `TypingDots`), `LiveEmployeeBubble` (one element from typing dots to finished line; its `layout` springs the frame), `useBubbleEntrance(side, delay, skip)` (rise + scale from the speaker's side), `SpeechCard` (drill line: avatar pops on `bouncy`, bubble rises after it; a `Bubble` with `tail={false}`, depth 5), `InstructionChip` (the task, target glyph, a `Callout`), `CoachSays` (mascot + `Bubble side="coach"`), `PossibleResponse` ("One possible MI-consistent response", never "correct").
- `Composer`: multiline, grows to 132pt then scrolls, focus ring cross-fades to cobalt, the send button wakes with a spring pop when there's text. Web: Enter sends, Shift+Enter adds a line.
- `Thinking`: `Shimmer` (a band sweeping a soft track: working, no fake percent), `RotatingLine` (cross-faded coach lines), `CoachThinking` (listening antelope + both).
- `Completion`: `usePracticeSnapshot()` captures streak/goal on mount; `PracticeTicks` rolls the streak (`RollingNumber` from → to) and advances the weekly ring (ochre + success haptic when the goal lands); `CompletionMoment` = celebrating antelope (cheers ~3s, then idles) + ticks + actions.
- `ConfirmSheet` (keep-going choice primary, leaving choice secondary, never red). `useKeyboardHeight()` for inputs inside sheets (Modal), where KeyboardAvoidingView doesn't reach.
- `moves.ts`: plain-language move names (`MOVE`, `movePhrase()` → "an open question" / "sharing information"), families (`FAMILY`: questions ● circle, reflections ◆ diamond, affirm & autonomy ■ square, telling or pushing ▲ triangle), zones ("Open to change" / "Mixed" / "Holding on"), `TALLY_ROWS`. `MoveMarker` renders a family's shape + colour everywhere (chart, legend, tallies).
- `errors.ts`: `friendlyError()` (offline / slow / busy / our fault, coach voice; always "your response is saved") and `withTimeout(ms)`.

## Lesson: `app/lesson/[id].tsx`, `components/lesson/CardStack.tsx`

Physical card stack. The top card follows the finger (rotation from distance + a spring-smoothed tilt from drag velocity), ticks a haptic at the point of no return, and either springs back (`release`, carrying velocity) or flies off carrying the flick. Cards underneath rise and scale toward the next slot as you drag; their words fade in as they surface. Either direction advances; Back flies the previous card in from the left while the current one recedes. NEXT drives the same flight. Progress dots: the current one stretches into a pill. Examples render as a "You might say" speech snippet. Reduced motion: no travel; a swipe or NEXT cross-fades. Finish → `CompletionMoment` → next activity in the unit (`START NEXT`, replace) or back.

## Drill: `app/drill/[id].tsx`, `components/drill/*`

Header: "Day N" (streak including today) + "N minutes of MI practice today", and a rep counter (hoofprint + rolling count that pops; invisible until the first rep lands, then it fades in as the count rolls to 1). Setup: skill chip, level chip (the six `LevelPips` inside the chip, so "level" reads the same as on Home), `SpeechCard`, `InstructionChip`.
- **Choices (level 1):** `ChoiceTiles`. Tap selects (tick haptic, soft face, cobalt edge, `StepBadge` letter pops); multi-target drills toggle ("Pick all that apply"). CHECK reveals: targets turn ochre with a check that pops, picks resolve first, every tile opens its explanation on a stagger, others dim slightly. Nothing is marked wrong. The coach reacts (hop + success haptic on a hit).
- **Free text:** docked `Composer`. Send → your words appear as a cobalt bubble, the antelope listens beside a shimmer (≥1.1s so the moment lands). `FeedbackPanel` rises on `gentle` over a light scrim: chip ("Did what the drill asked" ochre / "Worth another pass" soft), "That's a complex reflection." / "That landed as a closed question.", observation, what worked, possible responses, try next. Errors keep the text: TRY AGAIN or edit.
- "One more" chains the course activity's drills, then `DAILY_DRILL_ORDER`. The session is recorded once, on the first finished rep (closing early never loses it). "I'm done" → `CompletionMoment`.

## Role-play: `app/roleplay/[scenarioId].tsx`, `components/roleplay/*`

`RoleplayFlow` phases: brief → chat → reflect → thinking → debrief, each arriving with a short rise (`PhaseFade`; cross-fade when reduced). Keyed by scenario so a replaced screen starts fresh.
- `Brief`: persona, context + difficulty chips, situation, "Your goal" card with target skills, "How it works". Docked above START CONVERSATION: **Talk / Type** (`voice/VoiceBits › ModeChoice`, see Voice below). START CONVERSATION.
- `Conversation`: opening line is there immediately (no API call). `useEmployeeReply` streams `/api/roleplay/turn`: a read-pause scaled to your message, typing dots (header says "typing…"), then a word-at-a-time reveal from a buffer at ~46 chars/s (speeds up if the stream runs far ahead), so chunk sizes never show. Streamed replies don't re-enter when they settle. Auto-scroll follows unless you've scrolled up; then a "New reply" pill. "Your goal" folds away after your first reply (spring height). End stays quiet until 3 replies, then turns cobalt with a pop + tick; earlier ends go through a `ConfirmSheet`. Close asks before discarding. No live score.
- `Reflection` (before any AI feedback): Rough / Mixed / Solid tiles (weather icons, check badge, icon hop); the antelope's pose and line change with the choice; optional "What would you do differently?". SUBMIT starts the debrief request (the reflection goes with it); `CoachThinking` holds ~2.4s minimum with rotating lines. Errors keep everything.
- `Debrief`: coach answers your read first (celebrates when the trajectory rose), compact `PracticeTicks`, then:
  - `ReplayChart` (signature): monotone cubic through `trajectory` over plain-language bands, traced left→right with `strokeDashoffset`; employee replies are hollow rings, your moves are filled family markers between them (key moments ringed ochre), each popping on `bouncy` as the trace reaches it. Drag or tap: a guide line, halo and a callout (your line, their reply, observer notes) follow on springs with a light haptic per point. After the trace it settles on the first key moment. "List" toggles an accessible exchange list.
  - `MovesPanel`: rolling counters per move (dashed when zero) and a reflections-vs-questions balance beam that tips on a soft spring. A balance, not a grade.
  - Strengths, `KeyMoments` (snapping horizontal cards, next one peeks, ochre dot tracks scroll on the UI thread), Try next, What next (try again / practice this skill / harder / easier / new; coach's pick highlighted and docked as the primary), `ReviewSheet` (exactly what's shared and what isn't, optional note, account gates and cohort picker, the real submission state; see Accounts below).

## Voice: role-play Talk mode (`components/roleplay/voice/*`, contract `docs/voice.md`)

Hold to talk; the transcript becomes the learner's turn through the same path a typed reply takes (`Conversation › sendTurn` → `useEmployeeReply`), so the observer, coach, debrief and trainer review only ever see text. Claude stays the role-player; OpenAI does speech on the server.

- **Mode choice** (`ModeChoice`, in the brief's dock): two raised radio tiles, Talk ("Hold to speak") and Type ("Write replies"). Remembered in `settings.roleplayMode`; the default is Talk wherever the device can record (`voiceSupport › voiceAvailable`: native always, a browser needs getUserMedia + MediaRecorder) and the server hasn't said `voice_unavailable` this session. A Talk tile that can't work says why ("Not in this browser", "Resting right now") and is disabled. `practice_started` is sent at START with `mode`.
- **Fallback to Type**, with one muted line above the composer: mic permission denied ("The browser didn't share your mic, so let's type…" / "Your mic is off for this app…"; also remembers Type), or a 503 `voice_unavailable` ("Voice is taking a break, so let's type for now."). The keyboard button left of the mic switches by hand.
- **`useVoiceTurn()`**: `idle → recording → transcribing → thinking → speaking → idle`. Recording is expo-audio `useAudioRecorder` (iOS: m4a/AAC mono 64kbps; web: MediaRecorder, mp4 on WebKit, webm/opus elsewhere; `voiceSupport › RECORDING`). Release uploads multipart (`audio`, `scenarioId`, `durationMs`) to `/api/voice/transcribe` with `lib/api › postForm` (bearer + one refresh on 401). Too short (< 450ms) is a tap: "Hold the mic while you talk, then let go." At 59s it sends by itself. 422 → "Didn't catch that. Hold and try again."; 413 → "That one ran long…"; 429 / resting / offline use `friendlyError`, and the take is kept for "Send that again". The recording file or blob is discarded once uploaded.
- **Speaking**: `useEmployeeReply.request(…, sink)` hands the raw stream to `beginReply()`; `sentences.ts` cuts it into sentences as they complete (very short ones join the next, nothing over 560 chars). Each sentence is POSTed to `/api/voice/speak` in order, sentence n+1 fetched while n plays, and played through ONE long-lived output (`speechPlayer.web.ts`: one `<audio>` element; `speechPlayer.native.ts`: one expo-audio player, each MP3 written to the cache and deleted after). Captions stream exactly as in Type mode. Pressing the mic while they speak interrupts: playback stops, the queue and its pending fetches are dropped, recording starts; a reply still revealing is cut where it is (what you saw is what's in the transcript). Background or a hidden tab drops a take and stops speech; unmount releases recorder and player.
- **iOS Safari audio unlock**: an element may only play without a gesture once it has played inside one. `primeSpeech()` plays a 30ms silent WAV synchronously in the brief's START tap, and `armGestureUnlock()` does the same on any touchend / pointerup / click / keydown (capture phase) while a voice conversation is open, so the mic release itself unlocks too. Every sentence is then just a new `src` on that element. (expo-audio's web player makes a new `Audio()` per source, which would lose the unlock.) Verified in Safari on the iPhone 18 Pro simulator: the first reply after a fresh load plays (Safari shows its audio-playing indicator).
- **iOS native audio session**: `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })` before the first take (PlayAndRecord + DefaultToSpeaker, so replies use the loudspeaker), reset on unmount. `app.json` sets the expo-audio `microphonePermission` string (needs a new native build).

### `TalkDock` (the composer slot in Talk mode)

```
press      face drops onto its shadow (3D press, snappy) + press haptic; recording starts
hold       cobalt ring breathes behind the mic and swells with your voice: recorder metering written to a
           shared value ~16×/s from JS (never setState), drawn on the UI thread; "Listening… 0:07"
           (the timer is its own 1Hz component). From 50s it warms: "0:52 · 7s left"
slide      up (or sideways): "Slide up to cancel" chip fades in over the end of the thread; past 84pt a tick,
           the mic and chip turn warm (notice), the line reads "Release to cancel"
release    sends (or cancels past the line); the face springs back on `release`
then       "Getting your words" with a Shimmer → your bubble launches out of the mic (centre to centre,
           from small: `setLaunchPad({ from: 'center' })`) → "Len is thinking…"
speaking   header portrait gets a pulsing ring (`SpeakingRing`: playback level on iOS, else a 900ms loop),
           status "talking…"; dock: "Len is talking. Hold to cut in."
```

- Rules it keeps (both composer bugs): no per-frame or per-event setState (levels, drag and press are shared values; JS state changes only on state transitions and threshold crossings), and nothing invisible sits over a control: the rings and the cancel chip are `pointerEvents="none"`, the chip only mounts while recording, and `e2e/voice.spec.ts` asserts the element under the mic's centre is the mic.
- Header: `MuteToggle` (speaker / speaker-slash, 44pt) beside End, `settings.voiceMuted`. Muted keeps captions, stops playback now, and skips the speak requests; unmuting picks up at the next sentence.
- Reduced motion: no swelling, travel or breathing; the ring cross-fades with the level, the press is instant, the cancel chip appears without moving.
- Accessibility: the mic is a button labelled "Hold to talk" (hint "Slide up to cancel."), states are announced ("Listening", "Sending", "Len is talking", notices). With VoiceOver / TalkBack on, the mic becomes tap to start, tap again to send ("Stop and send"). Web: Space or Enter held works like the finger (react-native-web always reports a screen reader, so the web keeps the hold).
- Web: the mic has `touch-action: none` and no text selection or callout, so a long press on iOS Safari doesn't select or scroll. Type mode is unchanged (`KeyboardColumn`, `webKeyboard.ts`).
- Sessions with at least one spoken turn are saved with `practice_sessions.mode = 'voice'` (`PracticeSession.mode`, `outbox › sessionOp`).
- Analytics: `voice_turn_recorded {scenario_id, duration_ms}`, `voice_transcribe_failed {reason}`, `practice_started.mode`.
- Tests: `e2e/voice.spec.ts` (Chromium, fake microphone; WebKit skips it because Playwright WebKit has no fake capture device): touch hold → multipart upload with real audio → transcript bubble → streamed reply → speak requests in order and every clip played, cut-in, slide to cancel, mute, 422, 503 fallback, permission fallback. `e2e/composer.spec.ts` picks Type on the brief.

Captures (iOS simulator, Safari): `docs/screens/voice-*.jpg`. The simulator mic delivers no samples (uploads were empty mp4s), so the transcript there came from a local mock; real iOS capture and the native app's recorder still need a device.

## Tracks: `src/components/track`

- `TrackCard`: a big radio card (`accessibilityRole="radio"`). Selecting it: the face presses onto its shadow (tick), edge and face cross-fade to cobalt on periwinkle, the icon tile turns cobalt and hops (anticipation dip, bouncy rise), the radio's check pops in. Reduced motion: colours cross-fade only. `compact` drops the audience line; `current` marks the track you're on.
- Welcome track step: the head-pose coach listens, hops at the first pick, nods at a change of mind; CONTINUE fires `haptic.success`.
- `TrackSwitchSheet` (Me › Your track › Switch): both cards, the other track preselected, the note under them ticks over ("MI for Clinicians stays at week 3 of 8. MI for Leaders starts at week 1."), primary "Switch to Your team", secondary "Keep Patients". After a switch Me navigates to Path, which re-lays out for the new track (`PathTrack key={pathway.id}`).
- Join (`join.tsx`): when the cohort's `cohorts.pathway_id` differs from the active track, the success card offers the switch (source `cohort`) instead of a bare DONE.
- Path: 8- and 12-unit trails share one geometry (`components/path/geometry.ts`: step, amplitude and swing scale with unit count; the last week always sits at full swing into the finish). Captions sit 14pt from their node, 20pt for the current week (where its breathing ring has all but faded; less on a narrow screen, so the caption keeps 110pt). A caption that can reach the sky strip (`onSky`: above the lowest the first ridge ever sits) gets a white backing at `radius.badge`, because the night sky is navy under the dark caption text. Landscape per setting: savanna (acacias, sand) for workplace, wetland (sage bands, reeds, pools) for clinical.
- Path landmarks (`components/path/Landmarks.tsx`): a few big illustrations between weeks, drawn in the mascot's style (flat fills, one shade, cream highlights, thick ink outline) with a gentle idle loop: baobab, kopje with a sunbird, umbrella acacia with weaver nests, watering hole. Savanna gets all four, wetland the watering hole and kopje. `layoutLandmarks` puts each in its gap on the side the trail leaves free, as big as it fits clear of the trail, nodes and captions (it may peek in from the screen edge); small scenery props make way. The coach isn't avoided: it's drawn in front, so it stands by a landmark when it reaches one. Art lives in `scripts/landmarks/art.mjs` as SVG paths; `node scripts/landmarks/build.mjs [--preview]` writes `assets/rive/landmarks/*.riv` (state machine `Idle`), the web stills in `assets/images/landmarks/` and `landmarks.generated.ts`. Rive needs `dataBind={DataBindMode.None}` for these files (no view model).
- Setting-aware copy: role-play and review screens label the counterpart from the scenario's own setting (`SETTING_LABELS`, `practice-loop/names.ts › conversationLabel` "One-on-one with Josh" / "Visit with Len", `callName` keeps "Ms. Alvarez"). Never show "employee" for clinical content; `Turn.speaker` stays `'employee'` internally.
- Practice tab: follows the active setting, with a quiet TextLink to "Try leadership/patient practice instead"; tiles note "Role-play only" / "Coming soon for patients" when a setting has no drills for a skill, and Start borrows from the other setting with a caption.
- `Avatar` ages: `personaAvatar(persona, setting)` / `drillSpeakerAvatar(drill)` (`design/personaAge.ts`) infer age and presentation from the persona's role ("Patient, 61, …") or the drill context; older adults get grey or white hair, receding or bald styles, lines, reading glasses and knitwear; patients never get scrubs or a lanyard. Workplace seeds draw exactly as before. Dev grid: `antelope://dev/avatars`.
- Dev: `antelope://dev/track?id=mi-for-clinicians&to=/path&week=3` jumps onto a track.

Captures: `docs/screens/clinician-*.jpg`.

## Home

Greeting: the account's name when signed in, else just "Good morning" (the demo learner keeps "Amanda"). Daily rep card (below), new trainer feedback (`FeedbackCard`, when unseen), This week, From your trainer (`AssignmentCard` over an `AssignmentView`, demo or real: a `Callout` note, a gold `ProgressBar` whose segments fill by fraction for multi-rep items, `ListRow`s with a 24pt `StepBadge` check), Your progress (`ProgressList`: a level `StepBadge`, caption "Level 2 · Respond", `LevelPips` and "Next: Elicit"; no percentages), More practice (the focus skill sits in the header's action slot: "Focus this week: Sustain talk").

Daily rep: `DailyRepCard` over `data/dailyRep.ts`, which wraps `pickDailyRep` in core: one drill from the weakest unlocked skill (level, then percent), at its level, skipping drills done in the last 3 days; chips: skill, then "Drill · ~2 min"; START opens `/drill/<id>?source=today`. It is Home's one primary action and took the place of the old Today's practice card (the course order lives on Path). The first pick of the day is pinned in the store (`dailyRep`), so it holds while practice moves skill levels, and a tapped reminder opens the same drill. Once it's done the card says "Done today" and offers ONE MORE (the next pick, never a drill done today). A tapped reminder opens today's rep only from a tab screen: a tap that lands mid-session just returns to the session, and a tap after the rep is done stays put.

Streak freezes: a day a freeze covered shows in This week's strip as a periwinkle face with a cobalt `SnowflakeIcon` (kept, not earned, so never ochre). Home spends freezes on focus (`settleStreak`); the visit after one was spent, a `Callout` in the card says so once ("A streak freeze covered yesterday, so your 12-day streak is safe. You have 1 left."). A freeze that couldn't save the streak gets no note. Me shows the freezes held as two snowflake slots under the stats. Rules: `habit.ts` in core (start with 1, hold up to 2, earn 1 per weekly goal hit).

## Rules for the practice loop

- AI is never the authority: "One possible MI-consistent response", "That landed as…", no numeric scores, no grades, no red or X marks. `hitTarget` means "did what the drill asked".
- Self-reflection before AI feedback. The antelope is the coach; the employee is a person with an `Avatar` (the mascot never plays them).
- Every ending offers a way on (try again / practice this skill / harder / new). Trainer review is opt-in per session and says what's shared.
- **Don't:** hard-code a hex, radius, rgba or `fontFamily` in a screen (add a token or variant), put white glyphs on ochre, use `faint` for text you need to read, use emoji, purple gradients, blurred shadows, centred-everything layouts, walls of identical cards, scores or percentages for skills (use levels), or leaderboards.
