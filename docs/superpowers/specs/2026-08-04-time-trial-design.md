# Time Trial mode and a Challenges screen

## Why

Today the only way to play is the existing endless-streak mode ("Full Dex
Play" from here on): pick a generation, guess until you're wrong. This spec
adds a second mode, **Time Trial** — a fixed 10-round sprint against the
clock, scored into an S/A/B/C/D rank — plus a **Challenges** screen listing
each generation's personal-best rank/time and how many trials have been
played there.

## Scope

In scope: the Time Trial reducer and gameplay flow; sprite preloading so the
score isn't skewed by network variance; the S–D ranking formula; per-generation
personal-best/attempts persistence; the menu changes to offer both modes; the
Challenges screen.

Out of scope (explicitly, re-evaluate if this changes): resuming an
in-progress Time Trial after leaving the screen (abandoning mid-trial simply
discards it, no localStorage write); global/cross-player leaderboards (this is
a single-player, local-only game); per-`includeVariants` best tracking (Time
Trial follows Full Dex's existing convention of tracking bests per generation
only, not per generation×variants); manually skipping the reveal-then-advance
delay; difficulty ramping within a trial (fixed at 0 hard distractors for now,
configurable for later).

## Gameplay flow

A Time Trial is always exactly `TIME_TRIAL_ROUND_COUNT` (10) rounds, drawn
from the same generation/`includeVariants` pool (`pokemonPoolFor`) the menu's
existing picker already produces, with no repeats within the trial — same
`randomPokemonExcluding` helper `lib/game.ts` already exports.

1. **Start**: all 10 rounds (`{ pokemonId, options }`, `options` via the
   existing `generateOptions`, difficulty fixed at
   `TIME_TRIAL_HARD_DISTRACTORS`) are drawn up front, in one deterministic
   pass over the injected `rng` — not one at a time as the trial progresses.
2. **Preparing**: before round 1 is shown, the component preloads all 10
   answer sprites (`new Image()`, warming the browser cache — distractor
   options only ever render as text in `GuessButton`, so nothing else needs
   preloading) behind a "Preparing your trial…" placeholder. This is what
   makes round-to-round timing fair across players: without it, whoever has
   the faster connection gets a better time for reasons that have nothing to
   do with how quickly they recognized a silhouette. A fallback timeout
   starts the trial anyway if preloading stalls, so one bad asset request
   can't strand a player indefinitely.
3. **Timing starts** the instant preload resolves (or times out) and round 1
   is presented — not at trial creation, so the preload wait itself is never
   counted.
4. **Each round**: identical guessing UI to Full Dex Play (silhouette,
   4-option grid). A guess — right or wrong — reveals the answer and, after a
   fixed pause (`TIME_TRIAL_REVEAL_MS`, 900ms), auto-advances to the next
   round with no button press. This applies to both correct and incorrect
   guesses; a speed mode shouldn't stop the clock's momentum on every correct
   answer waiting for a click.
5. **Timing stops** the instant round 10's guess is registered — the final
   reveal's pause happens, but doesn't count against the score.
6. **Finish**: a results screen shows the rank, formatted time, and the
   correct/10 count.

Leaving mid-trial (the Home button) simply unmounts the component; nothing is
written to `localStorage` for an incomplete trial.

## `lib/timeTrial.ts`

A new pure module, mirroring `lib/game.ts`'s shape: a reducer plus helpers,
`Rng` (and now timestamps) passed in explicitly rather than read from
`Math.random`/`Date.now` internally, so it stays deterministically testable
with scripted values — the same reasoning that keeps `lib/game.ts` pure.

```ts
export type TimeTrialStatus = 'preparing' | 'loading' | 'guessing' | 'revealed' | 'finished'

export type TimeTrialRound = { pokemonId: number; options: number[] }
export type TimeTrialResult = { pokemonId: number; guess: number; correct: boolean }

export type TimeTrialState = {
  status: TimeTrialStatus
  rounds: TimeTrialRound[] // all TIME_TRIAL_ROUND_COUNT rounds, drawn once at START
  roundIndex: number
  guess: number | null
  // Same purpose as GameState.roundId: always changes when a new round is
  // presented (even on the vanishingly unlikely repeat draw), so
  // PokemonSilhouette's <img> reliably remounts and fires a fresh load event.
  roundId: number
  results: TimeTrialResult[] // completed rounds, oldest first
  generation: GenerationFilter
  includeVariants: boolean
  startedAt: number | null
  finishedAt: number | null
}

export type TimeTrialAction =
  | { type: 'START'; rng: Rng; generation: GenerationFilter; includeVariants: boolean }
  | { type: 'PRELOADED'; now: number }
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; pokemonId: number; now: number }
  | { type: 'ADVANCE' }
```

- `START` draws all 10 rounds against `pokemonPoolFor(generation,
  includeVariants)` and sets `status: 'preparing'`. No timing starts here.
- `PRELOADED` sets `startedAt: action.now` and `status: 'loading'` for round 1
  — the same `'loading'` → `'guessing'` flip Full Dex Play already uses is
  reused unchanged (via `IMAGE_READY`), it just resolves near-instantly since
  the sprite is already cache-warm.
- `GUESS` records the result, sets `status: 'revealed'`; if `roundIndex` is
  the last index, also sets `finishedAt: action.now`.
- `ADVANCE` (dispatched by the component after a `TIME_TRIAL_REVEAL_MS`
  timeout following every reveal) is pure index bookkeeping: if the round
  just revealed was the last one, sets `status: 'finished'`; otherwise
  increments `roundIndex`, sets `status: 'loading'`, bumps `roundId`. It never
  draws anything — the rounds were all decided at `START`.

## Ranking

New constants in `lib/gameConfig.ts`, alongside the existing
`DIFFICULTY_CURVE`:

```ts
export const TIME_TRIAL_ROUND_COUNT = 10
// Fixed for every round; independent of DIFFICULTY_CURVE so it can be tuned
// on its own later without touching the streak-based ramp.
export const TIME_TRIAL_HARD_DISTRACTORS = 0
// Pause on each reveal (correct or wrong) before auto-advancing.
export const TIME_TRIAL_REVEAL_MS = 900
// Only reachable with zero mistakes; a slower flawless run is still an A.
export const TIME_TRIAL_S_RANK_MAX_SECONDS = 45

export type TimeTrialRank = 'S' | 'A' | 'B' | 'C' | 'D'

export const rankTimeTrial = (correct: number, elapsedMs: number): TimeTrialRank => {
  const mistakes = TIME_TRIAL_ROUND_COUNT - correct
  if (mistakes === 0) return elapsedMs <= TIME_TRIAL_S_RANK_MAX_SECONDS * 1000 ? 'S' : 'A'
  if (mistakes === 1) return 'B'
  if (mistakes === 2) return 'C'
  return 'D'
}
```

Mistake count gates the band — a single miss can never be outrun into an S or
A no matter how fast the rest of the trial was — and elapsed time only ever
breaks the S/A tie within an otherwise-flawless run. All five tiers map
cleanly onto the four mistake bands (0 mistakes splits into two by time; 1, 2,
and 3+ mistakes each get one tier), so every threshold needed lives in this
one file.

## Persistence

Same per-generation key convention `bestStreak` already uses (`'all'` keeps
the bare key; every other generation gets a `:gen<N>` suffix), not split by
`includeVariants` — matching the existing streak-best convention documented
in CLAUDE.md.

```
timeTrialBest / timeTrialBest:gen<N>       → JSON: {"rank":"A","elapsedMs":52341,"correct":9}
timeTrialAttempts / timeTrialAttempts:gen<N> → plain integer string
```

`timeTrialAttempts` increments once per *completed* trial only; an abandoned
trial touches neither key.

A pure comparator in `lib/timeTrial.ts` decides whether a new result replaces
the stored best — rank first, elapsed time as the tiebreaker within the same
rank:

```ts
const RANK_ORDER: readonly TimeTrialRank[] = ['D', 'C', 'B', 'A', 'S']

export const isBetterTimeTrialResult = (
  candidate: { rank: TimeTrialRank; elapsedMs: number },
  current: { rank: TimeTrialRank; elapsedMs: number } | null,
): boolean => {
  if (!current) return true
  const candidateRank = RANK_ORDER.indexOf(candidate.rank)
  const currentRank = RANK_ORDER.indexOf(current.rank)
  return candidateRank !== currentRank ? candidateRank > currentRank : candidate.elapsedMs < current.elapsedMs
}
```

`Game.tsx` keeps owning all `localStorage` I/O, consistent with how it
already owns `bestStreak`/`streak`/`usedIds` persistence for Full Dex Play —
`TimeTrialGame` never touches `localStorage` directly. It reports a finished
trial up via `onFinish({ generation, correct, elapsedMs, rank })`; `Game.tsx`
compares against the stored best with `isBetterTimeTrialResult`, writes if
it's better, always increments the attempts counter, and updates its own
`challengesData` state so the Challenges screen reflects the new result
immediately without a reload.

## Screens & components

**Shared round-view extraction.** `Game.tsx`'s existing round markup —
silhouette, revealed name, guess grid, and their `mounted`/placeholder
handling — is pulled out into a presentational `RoundView` component so
`TimeTrialGame` can reuse it instead of duplicating that JSX. `Game.tsx`'s
`'game'` branch switches to rendering `<RoundView>` with no visible change.

**`components/TimeTrialGame.tsx`** — a second stateful component. CLAUDE.md's
"`Game.tsx` is the only stateful component" note is updated to name both:
Time Trial's state shape and lifecycle (a fixed 10-round trial with its own
preload/timer/auto-advance effects) are different enough from `GameState`
that folding them into the same reducer would mean branching most of its
cases on which mode is active. Owns `useReducer(timeTrialReducer, ...)`, the
preload effect, the reveal→`ADVANCE` timeout, and a display-only ticking-clock
effect (updates a local "now" state every ~100ms while in progress, frozen at
the recorded `finishedAt - startedAt` once `'finished'` so the displayed time
always matches the persisted one exactly). Renders:

- `'preparing'`: a spinner placeholder sized to match the round UI's
  footprint, same no-layout-shift reasoning as the existing hydration
  placeholders.
- in-progress: a new **`TimeTrialProgress`** bar ("Round 4/10" + the ticking
  timer) in place of `ScoreBoard`, then `RoundView`.
- `'finished'`: a new **`TimeTrialResults`** component — a color-coded rank
  badge, formatted time, correct/10, a "New personal best!" banner (reusing
  the `bg-best`/`border-lamp-amber` treatment `RunRecap` and the win screen
  already use for records) when `onFinish`'s result beat the previous best, a
  per-round list styled like `RunRecap`'s `RecapRow` (sprite, name,
  correct/wrong), and two buttons: **Retry** (dispatches a fresh `START` with
  the same generation/`includeVariants`) and **Main menu**.

`onFinish` fires exactly once per trial, from an effect keyed on
`status === 'finished'`.

**Menu changes.** `view` grows two values:
`'menu' | 'stats' | 'game' | 'timeTrial' | 'challenges'`. The single **Play**
button becomes two full-width primary buttons, **Full Dex** and **Time
Trial**, both reading the same generation/`includeVariants` picker above them
— unchanged from today. A new secondary **Challenges** button sits alongside
**Stats**. This only applies when no Full Dex run is in progress; the existing
`canContinue` branch (Continue/Start again + current-run summary) is
untouched, so Time Trial isn't offered until that run ends or is reset — Time
Trial has no equivalent "current run" state to resume anyway.

**Challenges screen.** `MainMenu`'s `mode` prop gains `'challenges'`, parallel
to `'stats'` — same `ScreenHeader`/corner-`Back`-button plumbing already
shared between `'menu'` and `'stats'`. One pill row per generation (plus
"All", the same `GENERATION_SELECT_OPTIONS` list `statsRows` already maps
over): the rank badge + formatted time (or "—" / "Not played yet" when
`best` is `null`), and an attempts count.

## Testing

- `lib/timeTrial.test.ts` (new): a full 10-round trial with scripted `rng`
  and `now` covering a mix of right/wrong guesses (`START` →
  `PRELOADED` → repeated `GUESS`/`ADVANCE` → `'finished'`); `finishedAt` is
  captured on round 10's `GUESS`, not after its `ADVANCE`; `isBetterTimeTrialResult`
  across all four cases (better rank, same rank faster, same rank slower, no
  existing best).
- `lib/gameConfig.test.ts` (extended): `rankTimeTrial` at each mistake band
  (0, 1, 2, 3+) and the S/A time boundary exactly at, just under, and just
  over `TIME_TRIAL_S_RANK_MAX_SECONDS`.
- `components/TimeTrialGame.test.tsx` (new, RTL + `user-event`, mirroring
  `Game.test.tsx`'s style): a full playthrough via the rendered UI: preload
  resolving, guessing all 10 rounds (mixing right/wrong), the results screen
  showing the correct rank/time/count, Retry starting a fresh trial, Main
  menu calling back out. The preload fallback timeout (an image that never
  fires `onload`/`onerror`, verifying the trial still starts).
- `components/MainMenu.test.tsx` (extended): the two-button Full Dex/Time
  Trial menu, and the new `'challenges'` mode's rows (including the "Not
  played yet" empty state).
- `components/Game.test.tsx` (extended, minimal): navigating into and out of
  `'timeTrial'`/`'challenges'` views from the menu.

No new edge case around pool size: the smallest generation (Gen 6) has 72
base species, comfortably over `TIME_TRIAL_ROUND_COUNT`, so drawing 10 unique
answers never needs a guard beyond what `randomPokemonExcluding` already has.

## Docs

CLAUDE.md gets: the "only stateful component" line updated to name both
`Game.tsx` and `TimeTrialGame.tsx`; a new section describing the Time Trial
flow, the preload rationale, and the ranking formula, alongside the existing
"Generation selection" section; the persistence section extended with the
`timeTrialBest`/`timeTrialAttempts` key convention.
