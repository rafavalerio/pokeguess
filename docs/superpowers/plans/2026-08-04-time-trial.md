# Time Trial Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second game mode — a 10-round, timed "Time Trial" with an S–D rank — plus a Challenges screen showing each generation's Time Trial personal best and attempt count.

**Architecture:** A new pure module (`lib/timeTrial.ts`) mirrors `lib/game.ts`'s reducer-plus-helpers shape (Rng and now-timestamps injected, never read internally) and drives a new second stateful component, `TimeTrialGame.tsx`, alongside the existing `Game.tsx`. The two share a `RoundView` presentational component extracted from the current inline round markup. `Game.tsx` keeps owning all `localStorage` I/O and passes data down as props, matching how it already owns `bestStreak`/`streak` persistence today.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind v4, Vitest + React Testing Library, oxlint.

## Global Constraints

- No semicolons, single quotes, 2-space indent (match each file's existing style when editing it).
- `@/*` path alias maps to the repo root.
- Components are arrow functions with a default export; `type Props = {...}` declared just above.
- Pure logic (`lib/*.ts`) never calls `Math.random`/`Date.now` internally — `Rng` and timestamps are passed in as arguments, so tests can script them.
- Interactive styling goes behind `enabled:` (e.g. `enabled:cursor-pointer`, `enabled:hover:*`).
- Before considering any task done: `npm run lint`, `npm run typecheck`, and `npm test` must all pass.
- Full spec: [docs/superpowers/specs/2026-08-04-time-trial-design.md](../specs/2026-08-04-time-trial-design.md).

---

## Task 1: Time Trial constants and ranking in `lib/gameConfig.ts`

**Files:**
- Modify: `lib/gameConfig.ts`
- Test: `lib/gameConfig.test.ts`

**Interfaces:**
- Produces: `TIME_TRIAL_ROUND_COUNT: number`, `TIME_TRIAL_HARD_DISTRACTORS: number`, `TIME_TRIAL_REVEAL_MS: number`, `TIME_TRIAL_PRELOAD_FALLBACK_MS: number`, `TIME_TRIAL_S_RANK_MAX_SECONDS: number`, `type TimeTrialRank = 'S' | 'A' | 'B' | 'C' | 'D'`, `rankTimeTrial(correct: number, elapsedMs: number): TimeTrialRank`.

- [ ] **Step 1: Write the failing tests**

Append to `lib/gameConfig.test.ts`:

```ts
import {
  DIFFICULTY_CURVE,
  TIME_TRIAL_ROUND_COUNT,
  TIME_TRIAL_S_RANK_MAX_SECONDS,
  hardDistractorCountForStreak,
  rankTimeTrial,
} from './gameConfig'
```

(replace the existing single-line import with the block above), then append at the end of the file:

```ts

describe('rankTimeTrial', () => {
  it('ranks a flawless run under the S threshold as S', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT, (TIME_TRIAL_S_RANK_MAX_SECONDS - 1) * 1000)).toBe('S')
  })

  it('ranks a flawless run exactly at the S threshold as S', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT, TIME_TRIAL_S_RANK_MAX_SECONDS * 1000)).toBe('S')
  })

  it('ranks a flawless run just over the S threshold as A', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT, TIME_TRIAL_S_RANK_MAX_SECONDS * 1000 + 1)).toBe('A')
  })

  it('ranks exactly one mistake as B regardless of time', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 1, 1)).toBe('B')
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 1, 999999)).toBe('B')
  })

  it('ranks exactly two mistakes as C', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 2, 1)).toBe('C')
  })

  it('ranks three or more mistakes as D', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 3, 1)).toBe('D')
    expect(rankTimeTrial(0, 1)).toBe('D')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- gameConfig`
Expected: FAIL — `rankTimeTrial` is not exported, and the import of `TIME_TRIAL_ROUND_COUNT`/`TIME_TRIAL_S_RANK_MAX_SECONDS` fails.

- [ ] **Step 3: Add the constants and `rankTimeTrial`**

Append to the end of `lib/gameConfig.ts`:

```ts

// A Time Trial is always this many rounds.
export const TIME_TRIAL_ROUND_COUNT = 10

// Fixed for every round of every Time Trial; independent of DIFFICULTY_CURVE
// so it can be tuned on its own later without touching the streak-based ramp.
export const TIME_TRIAL_HARD_DISTRACTORS = 0

// Pause on each reveal (correct or wrong) before auto-advancing to the next
// round.
export const TIME_TRIAL_REVEAL_MS = 900

// If sprite preloading hasn't resolved by this long, the trial starts anyway
// rather than leaving the player stuck on "Preparing your trial…" forever.
export const TIME_TRIAL_PRELOAD_FALLBACK_MS = 8000

// Only reachable with zero mistakes; a slower flawless run is still an A.
export const TIME_TRIAL_S_RANK_MAX_SECONDS = 45

export type TimeTrialRank = 'S' | 'A' | 'B' | 'C' | 'D'

// Mistake count gates the tier — a single miss can never be outrun into an S
// or A no matter how fast the rest of the trial was — and elapsed time only
// ever breaks the S/A tie within an otherwise-flawless run.
export const rankTimeTrial = (correct: number, elapsedMs: number): TimeTrialRank => {
  const mistakes = TIME_TRIAL_ROUND_COUNT - correct
  if (mistakes === 0) return elapsedMs <= TIME_TRIAL_S_RANK_MAX_SECONDS * 1000 ? 'S' : 'A'
  if (mistakes === 1) return 'B'
  if (mistakes === 2) return 'C'
  return 'D'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- gameConfig`
Expected: PASS, all tests including the pre-existing `hardDistractorCountForStreak` ones.

- [ ] **Step 5: Commit**

```bash
git add lib/gameConfig.ts lib/gameConfig.test.ts
git commit -m "Add Time Trial constants and the S-D ranking formula"
```

---

## Task 2: Decouple `generateOptions`'s hard-distractor target from streak

**Why this task exists:** Time Trial needs a *fixed* hard-distractor count (`TIME_TRIAL_HARD_DISTRACTORS`, currently 0) per round, not one derived from a streak. `generateOptions(answerId, streak, rng, pool)` currently computes that count internally via `hardDistractorCountForStreak(streak)`, so there's no way to pass a fixed count directly without either abusing `streak` (fragile: only coincidentally correct while `TIME_TRIAL_HARD_DISTRACTORS` happens to equal band 0) or duplicating the whole function. This task extracts the actual option-building logic into a lower-level function that takes the hard-distractor target directly, and makes `generateOptions` a one-line wrapper around it — a pure refactor, so all existing `generateOptions` tests must keep passing unchanged.

**Files:**
- Modify: `lib/game.ts:76-115`
- Test: `lib/game.test.ts`

**Interfaces:**
- Produces: `generateOptionsWithHardTarget(answerId: number, hardTarget: number, rng: Rng, pool?: readonly PokemonEntry[]): number[]`
- `generateOptions`'s existing signature and behavior are unchanged from every caller's perspective.

- [ ] **Step 1: Write the failing test**

Add to `lib/game.test.ts`, add `generateOptionsWithHardTarget` to the existing import from `./game`, then add this new `describe` block right after the existing `describe('generateOptions scales hard distractors with streak', ...)` block (around line 210):

```ts
describe('generateOptionsWithHardTarget', () => {
  it('matches generateOptions at streak 0 (hardTarget 0)', () => {
    const rngValues = [0.1, 0.2, 0.3]
    expect(generateOptionsWithHardTarget(42, 0, makeRng(rngValues))).toEqual(
      generateOptions(42, 0, makeRng(rngValues)),
    )
  })

  it('accepts an explicit hard-distractor target, independent of any streak band', () => {
    const kakunaId = 14 // dex 14; Butterfree(12)/Weedle(13)/Beedrill(15)/Pidgey(16) are all dex-adjacent hard candidates
    const kakuna = pokemonList.find((entry) => entry.id === kakunaId)!
    const hardCountIn = (options: number[]) =>
      options.filter(
        (id) => id !== kakunaId && isHardDistractor(kakuna, pokemonList.find((entry) => entry.id === id)!),
      ).length

    for (let seed = 0; seed < 20; seed += 1) {
      // hardTarget 2 passed directly — no streak value maps to this in
      // DIFFICULTY_CURVE's band 1 (which yields 1), proving the target isn't
      // being derived from a streak internally.
      const options = generateOptionsWithHardTarget(kakunaId, 2, makeRng([seed / 20, 0.11, 0.22, 0.33, 0.44]))
      expect(hardCountIn(options)).toBeGreaterThanOrEqual(2)
    }
  })

  it('returns exactly four unique options that always include the answer', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const options = generateOptionsWithHardTarget(42, 1, makeRng([seed / 20, 0.11, 0.22, 0.33]))
      expect(options).toHaveLength(4)
      expect(new Set(options).size).toBe(4)
      expect(options).toContain(42)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/game.test.ts`
Expected: FAIL — `generateOptionsWithHardTarget` is not exported from `./game`.

- [ ] **Step 3: Extract the function**

In `lib/game.ts`, replace the existing `generateOptions` function (lines 76-115) with:

```ts
export const generateOptionsWithHardTarget = (
  answerId: number,
  hardTarget: number,
  rng: Rng,
  pool: readonly PokemonEntry[] = pokemonList,
): number[] => {
  const answer = getPokemonEntry(answerId)
  const options = new Set<number>([answerId])

  // Skipped entirely at hardTarget 0 so the rng call sequence — and therefore
  // every existing scripted-rng test — is untouched when no hard distractors
  // are requested.
  if (hardTarget > 0) {
    const hardCandidates = shuffle(
      pool.filter((entry) => entry.id !== answerId && isHardDistractor(answer, entry)),
      rng,
    )
    for (const candidate of hardCandidates) {
      if (options.size >= 1 + hardTarget) break
      options.add(candidate.id)
    }
  }

  let guard = 0
  while (options.size < 4 && guard < 1000) {
    options.add(randomPokemon(rng, pool).id)
    guard += 1
  }
  // A degenerate rng (e.g. one that always returns the same value) can leave
  // the loop above short of 4 unique options even after the guard trips.
  // Deterministically fill any remaining slots so the result is always
  // exactly 4 unique ids.
  let index = 0
  while (options.size < Math.min(4, pool.length)) {
    options.add(pool[index].id)
    index = index >= pool.length - 1 ? 0 : index + 1
  }
  return shuffle([...options], rng)
}

export const generateOptions = (
  answerId: number,
  streak: number,
  rng: Rng,
  pool: readonly PokemonEntry[] = pokemonList,
): number[] => generateOptionsWithHardTarget(answerId, hardDistractorCountForStreak(streak), rng, pool)
```

- [ ] **Step 4: Run the tests to verify everything passes**

Run: `npm test -- lib/game.test.ts`
Expected: PASS — the new tests, and every pre-existing `generateOptions` test unchanged (this is a pure extraction; the streak-driven behavior is byte-for-byte identical).

- [ ] **Step 5: Commit**

```bash
git add lib/game.ts lib/game.test.ts
git commit -m "Extract generateOptionsWithHardTarget so the hard-distractor count can be set directly"
```

---

## Task 3: `lib/timeTrial.ts` — reducer, draw logic, formatting, comparator

**Files:**
- Create: `lib/timeTrial.ts`
- Test: `lib/timeTrial.test.ts`

**Interfaces:**
- Consumes: `Rng`, `randomPokemonExcluding`, `generateOptionsWithHardTarget` from `./game`; `pokemonPoolFor`, `type GenerationFilter` from `./generations`; `TIME_TRIAL_ROUND_COUNT`, `TIME_TRIAL_HARD_DISTRACTORS`, `type TimeTrialRank` from `./gameConfig`.
- Produces: `type TimeTrialStatus`, `type TimeTrialRound`, `type TimeTrialResult`, `type TimeTrialBest`, `type TimeTrialState`, `type TimeTrialAction`, `createInitialTimeTrialState(rng, generation, includeVariants): TimeTrialState`, `timeTrialReducer(state, action): TimeTrialState`, `formatElapsedMs(ms: number): string`, `isBetterTimeTrialResult(candidate: TimeTrialBest, current: TimeTrialBest | null): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `lib/timeTrial.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { pokemonPoolFor } from './generations'
import { TIME_TRIAL_ROUND_COUNT } from './gameConfig'
import {
  createInitialTimeTrialState,
  formatElapsedMs,
  isBetterTimeTrialResult,
  timeTrialReducer,
  type Rng,
} from './timeTrial'

const makeRng = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

// A constant rng makes randomPokemonExcluding's guard trip every time after
// the first draw, falling back to its deterministic "first still-unused
// entry" behavior — see lib/game.ts. That's fine here: these tests only
// assert structural properties (10 unique rounds, each with 4 options
// including its own answer), not which specific Pokémon get drawn.
const rng = makeRng([0.37])

describe('createInitialTimeTrialState', () => {
  it('draws exactly TIME_TRIAL_ROUND_COUNT unique rounds and starts in "preparing"', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)

    expect(state.status).toBe('preparing')
    expect(state.rounds).toHaveLength(TIME_TRIAL_ROUND_COUNT)
    expect(new Set(state.rounds.map((round) => round.pokemonId)).size).toBe(TIME_TRIAL_ROUND_COUNT)
    expect(state.startedAt).toBeNull()
    expect(state.finishedAt).toBeNull()
    expect(state.results).toEqual([])
    expect(state.roundIndex).toBe(0)
  })

  it('gives every round exactly 4 options that include that round\'s own answer', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)

    for (const round of state.rounds) {
      expect(round.options).toHaveLength(4)
      expect(new Set(round.options).size).toBe(4)
      expect(round.options).toContain(round.pokemonId)
    }
  })

  it('draws only from the given generation/includeVariants pool', () => {
    const pool = pokemonPoolFor(1, false)
    const poolIds = new Set(pool.map((entry) => entry.id))
    const state = createInitialTimeTrialState(rng, 1, false)

    for (const round of state.rounds) {
      expect(poolIds.has(round.pokemonId)).toBe(true)
    }
  })
})

describe('timeTrialReducer', () => {
  it('runs a full flawless trial from PRELOADED to finished', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)

    state = timeTrialReducer(state, { type: 'PRELOADED', now: 1000 })
    expect(state.status).toBe('loading')
    expect(state.startedAt).toBe(1000)

    for (let i = 0; i < TIME_TRIAL_ROUND_COUNT; i += 1) {
      state = timeTrialReducer(state, { type: 'IMAGE_READY' })
      expect(state.status).toBe('guessing')

      const round = state.rounds[state.roundIndex]
      const now = 1000 + (i + 1) * 500
      state = timeTrialReducer(state, { type: 'GUESS', pokemonId: round.pokemonId, now })
      expect(state.status).toBe('revealed')
      expect(state.results[i]).toEqual({ pokemonId: round.pokemonId, guess: round.pokemonId, correct: true })

      state = timeTrialReducer(state, { type: 'ADVANCE' })
      if (i < TIME_TRIAL_ROUND_COUNT - 1) {
        expect(state.status).toBe('loading')
        expect(state.roundIndex).toBe(i + 1)
      }
    }

    expect(state.status).toBe('finished')
    expect(state.finishedAt).toBe(1000 + TIME_TRIAL_ROUND_COUNT * 500)
    expect(state.results).toHaveLength(TIME_TRIAL_ROUND_COUNT)
    expect(state.results.every((result) => result.correct)).toBe(true)
  })

  it('records a wrong guess without ending the trial early', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)
    state = timeTrialReducer(state, { type: 'PRELOADED', now: 0 })
    state = timeTrialReducer(state, { type: 'IMAGE_READY' })

    const round = state.rounds[0]
    const wrongId = round.options.find((id) => id !== round.pokemonId)!
    state = timeTrialReducer(state, { type: 'GUESS', pokemonId: wrongId, now: 100 })

    expect(state.status).toBe('revealed')
    expect(state.results[0]).toEqual({ pokemonId: round.pokemonId, guess: wrongId, correct: false })

    state = timeTrialReducer(state, { type: 'ADVANCE' })
    expect(state.status).toBe('loading')
    expect(state.roundIndex).toBe(1)
  })

  it('sets finishedAt on the last round\'s GUESS, not on the ADVANCE that follows it', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)
    state = timeTrialReducer(state, { type: 'PRELOADED', now: 0 })
    for (let i = 0; i < TIME_TRIAL_ROUND_COUNT - 1; i += 1) {
      state = timeTrialReducer(state, { type: 'IMAGE_READY' })
      state = timeTrialReducer(state, {
        type: 'GUESS',
        pokemonId: state.rounds[state.roundIndex].pokemonId,
        now: i,
      })
      state = timeTrialReducer(state, { type: 'ADVANCE' })
    }
    state = timeTrialReducer(state, { type: 'IMAGE_READY' })
    expect(state.finishedAt).toBeNull()

    state = timeTrialReducer(state, {
      type: 'GUESS',
      pokemonId: state.rounds[state.roundIndex].pokemonId,
      now: 9999,
    })
    expect(state.status).toBe('revealed')
    expect(state.finishedAt).toBe(9999)

    state = timeTrialReducer(state, { type: 'ADVANCE' })
    expect(state.status).toBe('finished')
    expect(state.finishedAt).toBe(9999)
  })

  it('ignores GUESS when not in the guessing status', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)
    const result = timeTrialReducer(state, {
      type: 'GUESS',
      pokemonId: state.rounds[0].pokemonId,
      now: 0,
    })
    expect(result).toBe(state)
  })

  it('ignores ADVANCE when not in the revealed status', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)
    const result = timeTrialReducer(state, { type: 'ADVANCE' })
    expect(result).toBe(state)
  })

  it('START draws a completely fresh trial regardless of prior state', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)
    state = timeTrialReducer(state, { type: 'PRELOADED', now: 0 })
    state = timeTrialReducer(state, { type: 'IMAGE_READY' })
    state = timeTrialReducer(state, { type: 'GUESS', pokemonId: state.rounds[0].pokemonId, now: 5 })

    const restarted = timeTrialReducer(state, { type: 'START', rng, generation: 'all', includeVariants: false })
    expect(restarted.status).toBe('preparing')
    expect(restarted.roundIndex).toBe(0)
    expect(restarted.results).toEqual([])
    expect(restarted.startedAt).toBeNull()
    expect(restarted.finishedAt).toBeNull()
  })
})

describe('formatElapsedMs', () => {
  it('formats milliseconds as m:ss.t', () => {
    expect(formatElapsedMs(0)).toBe('0:00.0')
    expect(formatElapsedMs(1234)).toBe('0:01.2')
    expect(formatElapsedMs(65432)).toBe('1:05.4')
  })
})

describe('isBetterTimeTrialResult', () => {
  it('is always better than no existing best', () => {
    expect(isBetterTimeTrialResult({ rank: 'D', elapsedMs: 99999, correct: 0 }, null)).toBe(true)
  })

  it('prefers a higher rank regardless of time', () => {
    expect(
      isBetterTimeTrialResult(
        { rank: 'A', elapsedMs: 99999, correct: 10 },
        { rank: 'B', elapsedMs: 100, correct: 9 },
      ),
    ).toBe(true)
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 100, correct: 9 },
        { rank: 'A', elapsedMs: 99999, correct: 10 },
      ),
    ).toBe(false)
  })

  it('within the same rank, prefers a faster time', () => {
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 50000, correct: 9 },
        { rank: 'B', elapsedMs: 60000, correct: 9 },
      ),
    ).toBe(true)
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 70000, correct: 9 },
        { rank: 'B', elapsedMs: 60000, correct: 9 },
      ),
    ).toBe(false)
  })

  it('is not better when rank and time both tie', () => {
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 60000, correct: 9 },
        { rank: 'B', elapsedMs: 60000, correct: 9 },
      ),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- lib/timeTrial.test.ts`
Expected: FAIL — `./timeTrial` doesn't exist yet.

- [ ] **Step 3: Create `lib/timeTrial.ts`**

```ts
import { randomPokemonExcluding, generateOptionsWithHardTarget, type Rng } from './game'
import { pokemonPoolFor, type GenerationFilter } from './generations'
import { TIME_TRIAL_HARD_DISTRACTORS, TIME_TRIAL_ROUND_COUNT, type TimeTrialRank } from './gameConfig'
import type { PokemonEntry } from './pokemonData'

export type { Rng } from './game'

export type TimeTrialStatus = 'preparing' | 'loading' | 'guessing' | 'revealed' | 'finished'

export type TimeTrialRound = { pokemonId: number; options: number[] }

export type TimeTrialResult = { pokemonId: number; guess: number; correct: boolean }

// What's persisted to localStorage as a generation's personal best — see
// components/Game.tsx's timeTrialBestKey.
export type TimeTrialBest = { rank: TimeTrialRank; elapsedMs: number; correct: number }

export type TimeTrialState = {
  status: TimeTrialStatus
  rounds: TimeTrialRound[] // all TIME_TRIAL_ROUND_COUNT rounds, drawn once at START
  roundIndex: number
  guess: number | null
  // Same purpose as GameState.roundId (see lib/game.ts): always changes when
  // a new round is presented, so PokemonSilhouette's <img> reliably remounts
  // and fires a fresh load event even on the vanishingly unlikely repeat draw.
  roundId: number
  results: TimeTrialResult[] // completed rounds, oldest first
  generation: GenerationFilter
  includeVariants: boolean
  // Set once sprite preloading resolves and round 1 is actually presented —
  // not at trial creation — so the preload wait itself is never counted
  // against the player's time. See components/TimeTrialGame.tsx.
  startedAt: number | null
  // Set the instant the final round's GUESS is dispatched, not after that
  // round's reveal pause — the auto-advance delay never counts against the
  // score either.
  finishedAt: number | null
}

export type TimeTrialAction =
  | { type: 'START'; rng: Rng; generation: GenerationFilter; includeVariants: boolean }
  | { type: 'PRELOADED'; now: number }
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; pokemonId: number; now: number }
  | { type: 'ADVANCE' }

const drawTimeTrialRounds = (rng: Rng, pool: readonly PokemonEntry[]): TimeTrialRound[] => {
  const usedIds = new Set<number>()
  const rounds: TimeTrialRound[] = []
  for (let i = 0; i < TIME_TRIAL_ROUND_COUNT; i += 1) {
    const pokemonId = randomPokemonExcluding(rng, usedIds, pool).id
    usedIds.add(pokemonId)
    rounds.push({
      pokemonId,
      options: generateOptionsWithHardTarget(pokemonId, TIME_TRIAL_HARD_DISTRACTORS, rng, pool),
    })
  }
  return rounds
}

const startTimeTrialState = (rng: Rng, generation: GenerationFilter, includeVariants: boolean): TimeTrialState => {
  const pool = pokemonPoolFor(generation, includeVariants)
  return {
    status: 'preparing',
    rounds: drawTimeTrialRounds(rng, pool),
    roundIndex: 0,
    guess: null,
    roundId: 0,
    results: [],
    generation,
    includeVariants,
    startedAt: null,
    finishedAt: null,
  }
}

export const createInitialTimeTrialState = (
  rng: Rng,
  generation: GenerationFilter,
  includeVariants: boolean,
): TimeTrialState => startTimeTrialState(rng, generation, includeVariants)

export const timeTrialReducer = (state: TimeTrialState, action: TimeTrialAction): TimeTrialState => {
  switch (action.type) {
    case 'START':
      return startTimeTrialState(action.rng, action.generation, action.includeVariants)

    case 'PRELOADED':
      return state.status === 'preparing' ? { ...state, status: 'loading', startedAt: action.now } : state

    case 'IMAGE_READY':
      return state.status === 'loading' ? { ...state, status: 'guessing' } : state

    case 'GUESS': {
      if (state.status !== 'guessing') return state
      const round = state.rounds[state.roundIndex]
      const correct = action.pokemonId === round.pokemonId
      const isLastRound = state.roundIndex === state.rounds.length - 1
      return {
        ...state,
        status: 'revealed',
        guess: action.pokemonId,
        results: [...state.results, { pokemonId: round.pokemonId, guess: action.pokemonId, correct }],
        finishedAt: isLastRound ? action.now : state.finishedAt,
      }
    }

    case 'ADVANCE': {
      if (state.status !== 'revealed') return state
      const isLastRound = state.roundIndex === state.rounds.length - 1
      if (isLastRound) return { ...state, status: 'finished' }
      return { ...state, status: 'loading', roundIndex: state.roundIndex + 1, guess: null, roundId: state.roundId + 1 }
    }

    default:
      return state
  }
}

export const formatElapsedMs = (ms: number): string => {
  const totalTenths = Math.floor(ms / 100)
  const seconds = Math.floor(totalTenths / 10)
  const tenths = totalTenths % 10
  const minutes = Math.floor(seconds / 60)
  const remainderSeconds = seconds % 60
  return `${minutes}:${String(remainderSeconds).padStart(2, '0')}.${tenths}`
}

const RANK_ORDER: readonly TimeTrialRank[] = ['D', 'C', 'B', 'A', 'S']

// Rank first, elapsed time as the tiebreaker within the same rank — matches
// how personal bests are compared for the Challenges screen.
export const isBetterTimeTrialResult = (candidate: TimeTrialBest, current: TimeTrialBest | null): boolean => {
  if (!current) return true
  const candidateRank = RANK_ORDER.indexOf(candidate.rank)
  const currentRank = RANK_ORDER.indexOf(current.rank)
  return candidateRank !== currentRank ? candidateRank > currentRank : candidate.elapsedMs < current.elapsedMs
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- lib/timeTrial.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors from the `PokemonEntry` import or the reducer's discriminated union.

- [ ] **Step 6: Commit**

```bash
git add lib/timeTrial.ts lib/timeTrial.test.ts
git commit -m "Add the Time Trial reducer, draw logic, and personal-best comparator"
```

---

## Task 4: Extract `RoundView` from `Game.tsx`

**Why this task exists:** `Game.tsx`'s existing round markup (silhouette + revealed name + guess grid, plus their hydration placeholders) needs to be reused by the upcoming `TimeTrialGame` component. This task is a pure refactor — same DOM output, same behavior — so its test is running the existing `Game.test.tsx` suite before and after, not new test code.

**Files:**
- Create: `components/RoundView.tsx`
- Modify: `components/Game.tsx`
- Test: `components/Game.test.tsx` (unchanged — used as a regression check)

**Interfaces:**
- Produces: `RoundView` component with props `{ mounted: boolean; pokemonId: number; roundId: number; status: Status; options: number[]; guess: number | null; onReady: () => void; onGuess: (pokemonId: number) => void }`, where `Status` is `lib/game.ts`'s existing exported type.

- [ ] **Step 1: Confirm the regression baseline**

Run: `npm test -- components/Game.test.tsx`
Expected: PASS (this is today's baseline, before any change).

- [ ] **Step 2: Create `components/RoundView.tsx`**

```tsx
import { guessButtonClassName } from './GuessButton'
import GuessGrid from './GuessGrid'
import PokemonSilhouette from './PokemonSilhouette'
import type { Status } from '@/lib/game'
import { getPokemonName, getSpeciesDex } from '@/lib/pokemon'

// Reserves the exact footprint PokemonSilhouette renders at, so a caller that
// can't show the real silhouette yet (Game.tsx, before its hydration gate
// opens — see CLAUDE.md's hydration-constraint section) has nothing shift
// underneath it once the real content swaps in.
const SilhouettePlaceholder = () => (
  <div className="bg-screen-sunk mx-auto flex size-48 items-center justify-center rounded-full sm:size-56" />
)

// Each slot holds a skeleton bar rather than sitting empty: four blank boxes
// read as broken, where a bar reads as "not ready yet". The bar sits inside
// the same button box, so the slot keeps the exact height of the loaded state.
const GuessGridPlaceholder = () => (
  <div className="flex flex-col gap-2">
    {[0, 1, 2, 3].map((slot) => (
      // These skeletons are disabled and unlabelled on purpose: they exist to
      // hold the slot's footprint until the real options arrive. Labelling them
      // would announce four fake options that cannot be pressed.
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label
      <button key={slot} type="button" disabled className={guessButtonClassName('idle')}>
        <span className="hidden size-5 shrink-0 sm:block" />
        <span className="flex h-5 items-center">
          <span className="bg-screen-sunk block h-2.5 w-16 animate-pulse rounded-full" />
        </span>
      </button>
    ))}
  </div>
)

type Props = {
  // false only for Game.tsx's Full Dex mode before its hydration gate opens.
  // TimeTrialGame mounts purely client-side (only reachable via a menu
  // click), so it always passes true.
  mounted: boolean
  pokemonId: number
  roundId: number
  status: Status
  options: number[]
  guess: number | null
  onReady: () => void
  onGuess: (pokemonId: number) => void
}

// The silhouette + revealed name + guess grid trio, shared by Game.tsx's
// Full Dex mode and TimeTrialGame — the only difference between the two
// callers is what drives status/options/guess, not how they're shown.
const RoundView = ({ mounted, pokemonId, roundId, status, options, guess, onReady, onGuess }: Props) => {
  const revealed = status === 'revealed'
  return (
    <>
      <div className="mb-3">
        {mounted ? (
          <PokemonSilhouette pokemonId={pokemonId} roundId={roundId} status={status} onReady={onReady} />
        ) : (
          <SilhouettePlaceholder />
        )}
      </div>

      <p className="text-ink mb-4 h-6 text-center text-sm font-semibold tabular-nums" data-testid="round-answer">
        {revealed ? `#${getSpeciesDex(pokemonId)} · ${getPokemonName(pokemonId)}` : ' '}
      </p>

      {mounted && status !== 'loading' ? (
        <GuessGrid
          options={options}
          answer={pokemonId}
          guess={guess}
          revealed={revealed}
          disabled={status !== 'guessing'}
          onGuess={onGuess}
        />
      ) : (
        <GuessGridPlaceholder />
      )}
    </>
  )
}

export default RoundView
```

- [ ] **Step 3: Wire `Game.tsx` to use `RoundView`**

In `components/Game.tsx`:

1. Remove the `guessButtonClassName` import from `'./GuessButton'` (no longer used directly).
2. Remove `getSpeciesDex` from the `@/lib/pokemon` import, keeping `getPokemonName` (still used by `missedGuess`).
3. Remove the `SilhouettePlaceholder` and `GuessGridPlaceholder` component definitions (lines 48-70) — they now live in `RoundView.tsx`.
4. Add `import RoundView from './RoundView'`.
5. Replace this block (originally lines 350-380):

```tsx
        <>
          <div className="mb-3">
            {mounted ? (
              <PokemonSilhouette
                pokemonId={state.pokemonId}
                roundId={state.roundId}
                status={state.status}
                onReady={handleReady}
              />
            ) : (
              <SilhouettePlaceholder />
            )}
          </div>

          <p className="text-ink mb-4 h-6 text-center text-sm font-semibold tabular-nums">
            {revealed ? `#${getSpeciesDex(state.pokemonId)} · ${getPokemonName(state.pokemonId)}` : ' '}
          </p>

          {mounted && state.status !== 'loading' ? (
            <GuessGrid
              options={state.options}
              answer={state.pokemonId}
              guess={state.guess}
              revealed={revealed}
              disabled={state.status !== 'guessing'}
              onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId })}
            />
          ) : (
            <GuessGridPlaceholder />
          )}
        </>
```

with:

```tsx
        <RoundView
          mounted={mounted}
          pokemonId={state.pokemonId}
          roundId={state.roundId}
          status={state.status}
          options={state.options}
          guess={state.guess}
          onReady={handleReady}
          onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId })}
        />
```

6. `GuessGrid` and `PokemonSilhouette` are no longer imported directly by `Game.tsx` — remove those two imports (`import GuessGrid from './GuessGrid'` and `import PokemonSilhouette from './PokemonSilhouette'`).

- [ ] **Step 4: Run the regression suite**

Run: `npm test -- components/Game.test.tsx`
Expected: PASS — identical results to Step 1. `RoundView`'s new `data-testid="round-answer"` attribute is additive and doesn't affect any existing query.

- [ ] **Step 5: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS — no unused-import warnings (the removed imports must actually be gone).

- [ ] **Step 6: Commit**

```bash
git add components/RoundView.tsx components/Game.tsx
git commit -m "Extract RoundView from Game.tsx so Time Trial can reuse the round UI"
```

---

## Task 5: `RankBadge` component

**Files:**
- Create: `components/RankBadge.tsx`
- Test: `components/RankBadge.test.tsx`

**Interfaces:**
- Consumes: `type TimeTrialRank` from `@/lib/gameConfig`.
- Produces: `RankBadge` component with props `{ rank: TimeTrialRank; size?: 'sm' | 'lg' }`.

- [ ] **Step 1: Write the failing test**

Create `components/RankBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import RankBadge from './RankBadge'

describe('RankBadge', () => {
  it('renders the rank letter', () => {
    render(<RankBadge rank="A" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('gives S its own gold treatment, distinct from the other ranks', () => {
    const { unmount } = render(<RankBadge rank="S" />)
    expect(screen.getByText('S').className).toContain('bg-best/40')
    unmount()

    render(<RankBadge rank="A" />)
    expect(screen.getByText('A').className).not.toContain('bg-best/40')
  })

  it('renders larger at size="lg"', () => {
    render(<RankBadge rank="B" size="lg" />)
    expect(screen.getByText('B').className).toContain('size-16')
  })

  it('defaults to the small size', () => {
    render(<RankBadge rank="C" />)
    expect(screen.getByText('C').className).toContain('size-7')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/RankBadge.test.tsx`
Expected: FAIL — `./RankBadge` doesn't exist.

- [ ] **Step 3: Create `components/RankBadge.tsx`**

```tsx
import type { TimeTrialRank } from '@/lib/gameConfig'

const RANK_STYLES: Record<TimeTrialRank, string> = {
  S: 'bg-best/40 border-lamp-amber text-best-ink',
  A: 'bg-screen-sunk border-transparent text-ink-strong',
  B: 'bg-screen-sunk border-transparent text-ink-strong',
  C: 'bg-screen-sunk border-transparent text-ink-strong',
  D: 'bg-screen-sunk border-transparent text-ink-strong',
}

type Props = {
  rank: TimeTrialRank
  size?: 'sm' | 'lg'
}

// The one place a Time Trial rank turns into a badge, shared by the results
// screen (size="lg") and the Challenges list (default "sm") so the two never
// pick different colors for the same rank.
const RankBadge = ({ rank, size = 'sm' }: Props) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 font-bold tabular-nums ${RANK_STYLES[rank]} ${
      size === 'lg' ? 'size-16 text-3xl' : 'size-7 text-sm'
    }`}
  >
    {rank}
  </span>
)

export default RankBadge
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/RankBadge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/RankBadge.tsx components/RankBadge.test.tsx
git commit -m "Add RankBadge for displaying Time Trial ranks"
```

---

## Task 6: `TimeTrialProgress` component

**Files:**
- Create: `components/TimeTrialProgress.tsx`
- Test: `components/TimeTrialProgress.test.tsx`

**Interfaces:**
- Consumes: `formatElapsedMs` from `@/lib/timeTrial`.
- Produces: `TimeTrialProgress` component with props `{ roundIndex: number; totalRounds: number; elapsedMs: number }`.

- [ ] **Step 1: Write the failing test**

Create `components/TimeTrialProgress.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TimeTrialProgress from './TimeTrialProgress'

describe('TimeTrialProgress', () => {
  it('shows the 1-indexed round out of the total', () => {
    render(<TimeTrialProgress roundIndex={3} totalRounds={10} elapsedMs={0} />)
    expect(screen.getByText('Round 4/10')).toBeInTheDocument()
  })

  it('shows the elapsed time formatted as m:ss.t', () => {
    render(<TimeTrialProgress roundIndex={0} totalRounds={10} elapsedMs={65432} />)
    expect(screen.getByTestId('time-trial-clock')).toHaveTextContent('1:05.4')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/TimeTrialProgress.test.tsx`
Expected: FAIL — `./TimeTrialProgress` doesn't exist.

- [ ] **Step 3: Create `components/TimeTrialProgress.tsx`**

```tsx
import { formatElapsedMs } from '@/lib/timeTrial'

type Props = {
  roundIndex: number
  totalRounds: number
  elapsedMs: number
}

// Replaces ScoreBoard on the Time Trial screen: a round counter and a live
// ticking clock instead of streak/best.
const TimeTrialProgress = ({ roundIndex, totalRounds, elapsedMs }: Props) => (
  <div className="flex items-center justify-center gap-5">
    <span className="text-ink text-sm font-semibold tabular-nums">{`Round ${roundIndex + 1}/${totalRounds}`}</span>
    <span className="text-ink text-sm font-semibold tabular-nums" data-testid="time-trial-clock">
      {formatElapsedMs(elapsedMs)}
    </span>
  </div>
)

export default TimeTrialProgress
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/TimeTrialProgress.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/TimeTrialProgress.tsx components/TimeTrialProgress.test.tsx
git commit -m "Add TimeTrialProgress round counter and live clock"
```

---

## Task 7: `TimeTrialResults` component

**Files:**
- Create: `components/TimeTrialResults.tsx`
- Test: `components/TimeTrialResults.test.tsx`

**Interfaces:**
- Consumes: `RankBadge` (Task 5); `formatElapsedMs` from `@/lib/timeTrial`; `type TimeTrialRank` from `@/lib/gameConfig`; `getPokemonName`, `getSpriteUrl` from `@/lib/pokemon`.
- Produces: `TimeTrialResults` component with props `{ rank: TimeTrialRank; elapsedMs: number; correct: number; totalRounds: number; results: { pokemonId: number; guess: number; correct: boolean }[]; isNewBest: boolean; onRetry: () => void; onMainMenu: () => void }`.

- [ ] **Step 1: Write the failing test**

Create `components/TimeTrialResults.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import TimeTrialResults from './TimeTrialResults'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const baseProps = {
  rank: 'B' as const,
  elapsedMs: 65432,
  correct: 8,
  totalRounds: 10,
  // ids 1/2 are real dex entries (Bulbasaur/Ivysaur) and 4 is Charmander,
  // same convention RunRecap.test.tsx uses, so getPokemonName resolves them
  // without any mocking.
  results: [
    { pokemonId: 1, guess: 1, correct: true },
    { pokemonId: 2, guess: 4, correct: false },
  ],
  isNewBest: false,
  onRetry: vi.fn(),
  onMainMenu: vi.fn(),
}

describe('TimeTrialResults', () => {
  it('shows the rank, formatted time and correct count', () => {
    render(<TimeTrialResults {...baseProps} />)

    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('1:05.4')).toBeInTheDocument()
    expect(screen.getByText('8/10')).toBeInTheDocument()
  })

  it('shows a "New personal best!" banner only when isNewBest is true', () => {
    const { rerender } = render(<TimeTrialResults {...baseProps} isNewBest={false} />)
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument()

    rerender(<TimeTrialResults {...baseProps} isNewBest={true} />)
    expect(screen.getByText('New personal best!')).toBeInTheDocument()
  })

  it('lists every round by its Pokémon name', () => {
    render(<TimeTrialResults {...baseProps} />)

    expect(screen.getByText('Bulbasaur')).toBeInTheDocument()
    expect(screen.getByText('Ivysaur')).toBeInTheDocument()
  })

  it('shows what was guessed instead for a wrong round', () => {
    render(<TimeTrialResults {...baseProps} />)

    expect(screen.getByText('Guessed Charmander')).toBeInTheDocument()
  })

  it('calls onRetry when Retry is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<TimeTrialResults {...baseProps} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('calls onMainMenu when Main menu is clicked', async () => {
    const user = userEvent.setup()
    const onMainMenu = vi.fn()
    render(<TimeTrialResults {...baseProps} onMainMenu={onMainMenu} />)

    await user.click(screen.getByRole('button', { name: 'Main menu' }))
    expect(onMainMenu).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- components/TimeTrialResults.test.tsx`
Expected: FAIL — `./TimeTrialResults` doesn't exist.

- [ ] **Step 3: Create `components/TimeTrialResults.tsx`**

```tsx
import { Check, X } from 'lucide-react'
import Image from 'next/image'

import RankBadge from './RankBadge'
import type { TimeTrialRank } from '@/lib/gameConfig'
import { getPokemonName, getSpriteUrl } from '@/lib/pokemon'
import { formatElapsedMs } from '@/lib/timeTrial'

type ResultEntry = { pokemonId: number; guess: number; correct: boolean }

type Props = {
  rank: TimeTrialRank
  elapsedMs: number
  correct: number
  totalRounds: number
  results: ResultEntry[]
  isNewBest: boolean
  onRetry: () => void
  onMainMenu: () => void
}

const primaryButtonClassName =
  'bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const secondaryButtonClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell enabled:hover:bg-screen-sunk flex w-full select-none items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const ResultRow = ({
  round,
  pokemonId,
  guess,
  correct,
}: {
  round: number
  pokemonId: number
  guess: number
  correct: boolean
}) => (
  <div className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${correct ? 'bg-screen-sunk' : 'bg-wrong'}`}>
    <span
      className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-black/10 px-1.5 text-xs font-semibold tabular-nums ${
        correct ? 'text-ink-soft' : 'text-wrong-ink'
      }`}
    >
      {round}
    </span>
    <Image src={getSpriteUrl(pokemonId)} alt="" aria-hidden="true" width={32} height={32} className="size-8 shrink-0" />
    <div className="min-w-0 flex-1 text-left">
      <p className={`truncate text-sm font-medium ${correct ? 'text-ink' : 'text-wrong-ink'}`}>
        {getPokemonName(pokemonId)}
      </p>
      {!correct && <p className="text-wrong-ink/80 truncate text-xs">Guessed {getPokemonName(guess)}</p>}
    </div>
    {correct ? (
      <Check className="text-correct size-4 shrink-0" aria-hidden="true" />
    ) : (
      <X className="text-wrong-ink size-4 shrink-0" aria-hidden="true" />
    )}
  </div>
)

const TimeTrialResults = ({
  rank,
  elapsedMs,
  correct,
  totalRounds,
  results,
  isNewBest,
  onRetry,
  onMainMenu,
}: Props) => (
  <div className="mb-3 flex flex-col gap-3 text-left">
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl px-4 py-4 text-center ${
        isNewBest ? 'bg-best/40 border-lamp-amber border-2' : 'bg-screen-sunk border-2 border-transparent'
      }`}
    >
      {isNewBest && <p className="text-best-ink text-xs font-semibold tracking-wide uppercase">New personal best!</p>}
      <RankBadge rank={rank} size="lg" />
      <div className="divide-ink-soft/20 grid w-full grid-cols-2 divide-x">
        <div>
          <p className="text-ink-soft text-xs font-medium">Time</p>
          <p className="text-ink mt-1 text-2xl font-semibold tabular-nums">{formatElapsedMs(elapsedMs)}</p>
        </div>
        <div>
          <p className="text-ink-soft text-xs font-medium">Correct</p>
          <p className="text-ink mt-1 text-2xl font-semibold tabular-nums">{`${correct}/${totalRounds}`}</p>
        </div>
      </div>
    </div>

    <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
      {results.map((entry, index) => (
        <ResultRow
          key={`${entry.pokemonId}-${index}`}
          round={index + 1}
          pokemonId={entry.pokemonId}
          guess={entry.guess}
          correct={entry.correct}
        />
      ))}
    </div>

    <div className="flex flex-col gap-2">
      <button type="button" onClick={onRetry} className={primaryButtonClassName}>
        Retry
      </button>
      <button type="button" onClick={onMainMenu} className={secondaryButtonClassName}>
        Main menu
      </button>
    </div>
  </div>
)

export default TimeTrialResults
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- components/TimeTrialResults.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/TimeTrialResults.tsx components/TimeTrialResults.test.tsx
git commit -m "Add TimeTrialResults screen"
```

---

## Task 8: `TimeTrialGame` — the stateful Time Trial component

**Files:**
- Create: `components/TimeTrialGame.tsx`
- Test: `components/TimeTrialGame.test.tsx`

**Interfaces:**
- Consumes: `createInitialTimeTrialState`, `timeTrialReducer`, `isBetterTimeTrialResult`, `type TimeTrialBest` from `@/lib/timeTrial`; `rankTimeTrial`, `TIME_TRIAL_REVEAL_MS`, `TIME_TRIAL_PRELOAD_FALLBACK_MS`, `type TimeTrialRank` from `@/lib/gameConfig`; `type GenerationFilter` from `@/lib/generations`; `getSpriteUrl` from `@/lib/pokemon`; `RoundView` (Task 4), `TimeTrialProgress` (Task 6), `TimeTrialResults` (Task 7).
- Produces: `TimeTrialGame` component with props `{ generation: GenerationFilter; includeVariants: boolean; personalBest: TimeTrialBest | null; onFinish: (result: { generation: GenerationFilter; correct: number; elapsedMs: number; rank: TimeTrialRank }) => void; onExit: () => void }`.

- [ ] **Step 1: Write the failing tests**

Create `components/TimeTrialGame.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TimeTrialGame from './TimeTrialGame'
import { TIME_TRIAL_PRELOAD_FALLBACK_MS, TIME_TRIAL_REVEAL_MS, TIME_TRIAL_ROUND_COUNT, rankTimeTrial } from '@/lib/gameConfig'

vi.mock('next/image', async () => {
  const { useEffect } = await import('react')
  const MockImage = ({ onLoad, alt }: { onLoad?: () => void; alt: string }) => {
    useEffect(() => {
      onLoad?.()
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, mirrors a real <img>'s one-time load event
    }, [])
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
    return <img alt={alt} />
  }
  return { default: MockImage }
})

// Resolves on the next microtask, mimicking a cache-warm image load — fake
// timers (see beforeEach) don't affect microtask scheduling, so this settles
// on its own without needing to advance any timer.
class MockPreloadImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    Promise.resolve().then(() => this.onload?.())
  }
}

const getGuessButtons = (): HTMLElement[] =>
  screen.getAllByRole('button').filter((b) => b.textContent !== 'Retry' && b.textContent !== 'Main menu')

describe('TimeTrialGame', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockPreloadImage)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Clicks the first rendered guess option every round, then reads the
  // revealed answer to learn ground truth. This never predicts which
  // Pokémon the trial's internal rng actually drew — it only observes what
  // RoundView reveals — so it stays correct regardless of the draw.
  const playThrough = async (user: ReturnType<typeof userEvent.setup>): Promise<number> => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0) // let the preload microtasks settle
    })

    let correct = 0
    for (let round = 1; round <= TIME_TRIAL_ROUND_COUNT; round += 1) {
      expect(screen.getByText(`Round ${round}/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
      const button = getGuessButtons()[0]
      const guessedName = button.textContent ?? ''
      await user.click(button)

      const revealedText = screen.getByTestId('round-answer').textContent ?? ''
      if (revealedText.endsWith(guessedName)) correct += 1

      await act(async () => {
        await vi.advanceTimersByTimeAsync(TIME_TRIAL_REVEAL_MS)
      })
    }
    return correct
  }

  it('shows the round counter once the trial is ready', async () => {
    render(
      <TimeTrialGame generation="all" includeVariants={false} personalBest={null} onFinish={vi.fn()} onExit={vi.fn()} />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(`Round 1/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })

  it('plays through all 10 rounds and reports the finished trial exactly once', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onFinish = vi.fn()
    render(
      <TimeTrialGame generation="all" includeVariants={false} personalBest={null} onFinish={onFinish} onExit={vi.fn()} />,
    )

    const correct = await playThrough(user)

    expect(onFinish).toHaveBeenCalledOnce()
    const payload = onFinish.mock.calls[0][0]
    expect(payload.generation).toBe('all')
    expect(payload.correct).toBe(correct)
    expect(payload.elapsedMs).toBeGreaterThan(0)
    expect(payload.rank).toBe(rankTimeTrial(correct, payload.elapsedMs))
    expect(screen.getByText(`${correct}/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })

  it('calls onExit when Main menu is clicked from the results screen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onExit = vi.fn()
    render(
      <TimeTrialGame generation="all" includeVariants={false} personalBest={null} onFinish={vi.fn()} onExit={onExit} />,
    )

    await playThrough(user)
    await user.click(screen.getByRole('button', { name: 'Main menu' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('starts a fresh trial when Retry is clicked from the results screen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <TimeTrialGame generation="all" includeVariants={false} personalBest={null} onFinish={vi.fn()} onExit={vi.fn()} />,
    )

    await playThrough(user)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(`Round 1/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })

  it('still starts the trial if a sprite never finishes preloading, via the fallback timeout', async () => {
    class NeverLoadsImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        // Deliberately never resolves, to exercise the fallback timeout.
      }
    }
    vi.stubGlobal('Image', NeverLoadsImage)

    render(
      <TimeTrialGame generation="all" includeVariants={false} personalBest={null} onFinish={vi.fn()} onExit={vi.fn()} />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIME_TRIAL_PRELOAD_FALLBACK_MS)
    })
    expect(screen.getByText(`Round 1/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- components/TimeTrialGame.test.tsx`
Expected: FAIL — `./TimeTrialGame` doesn't exist.

- [ ] **Step 3: Create `components/TimeTrialGame.tsx`**

```tsx
'use client'

import Image from 'next/image'
import { useEffect, useReducer, useState } from 'react'

import RoundView from './RoundView'
import TimeTrialProgress from './TimeTrialProgress'
import TimeTrialResults from './TimeTrialResults'
import {
  rankTimeTrial,
  TIME_TRIAL_PRELOAD_FALLBACK_MS,
  TIME_TRIAL_REVEAL_MS,
  type TimeTrialRank,
} from '@/lib/gameConfig'
import type { GenerationFilter } from '@/lib/generations'
import { getSpriteUrl } from '@/lib/pokemon'
import {
  createInitialTimeTrialState,
  isBetterTimeTrialResult,
  timeTrialReducer,
  type Rng,
  type TimeTrialBest,
} from '@/lib/timeTrial'

const rng: Rng = () => Math.random()

type FinishPayload = { generation: GenerationFilter; correct: number; elapsedMs: number; rank: TimeTrialRank }

type Props = {
  generation: GenerationFilter
  includeVariants: boolean
  // The generation's current personal best, if any — used to decide whether
  // this trial's result counts as a new one. Game.tsx owns the actual
  // localStorage read/write; this component only compares.
  personalBest: TimeTrialBest | null
  onFinish: (result: FinishPayload) => void
  onExit: () => void
}

// Sized to roughly match the round UI's footprint, though an exact match
// isn't required here — PokedexShell's ResizeObserver-driven height
// transition (see components/PokedexShell.tsx) already smooths over content
// height changes between views.
const Preparing = () => (
  <div className="bg-screen-sunk flex h-64 flex-col items-center justify-center gap-3 rounded-2xl">
    <Image
      src="/images/pokeball.png"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      className="animate-pokeball-spin size-10"
    />
    <p className="text-ink-soft text-sm font-medium">Preparing your trial…</p>
  </div>
)

const TimeTrialGame = ({ generation, includeVariants, personalBest, onFinish, onExit }: Props) => {
  const [state, dispatch] = useReducer(timeTrialReducer, undefined, () =>
    createInitialTimeTrialState(rng, generation, includeVariants),
  )
  // Drives the ticking clock display; the reducer's own startedAt/finishedAt
  // stay the source of truth for the score itself (see lib/timeTrial.ts).
  const [displayNow, setDisplayNow] = useState<number>(() => Date.now())

  // Preloads every answer sprite before round 1 is shown, so no player's
  // score is skewed by their connection speed — see the design spec's
  // "Preparing, then preload" note. Distractor options only ever render as
  // text (GuessButton), so nothing else needs preloading.
  useEffect(() => {
    if (state.status !== 'preparing') return
    let cancelled = false

    const loadOne = (url: string) =>
      new Promise<void>((resolve) => {
        const img = new window.Image()
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = url
      })
    const fallback = new Promise<void>((resolve) => {
      setTimeout(resolve, TIME_TRIAL_PRELOAD_FALLBACK_MS)
    })

    Promise.race([Promise.all(state.rounds.map((round) => loadOne(getSpriteUrl(round.pokemonId)))), fallback]).then(
      () => {
        if (!cancelled) dispatch({ type: 'PRELOADED', now: Date.now() })
      },
    )

    return () => {
      cancelled = true
    }
  }, [state.status, state.rounds])

  // Auto-advances a fixed delay after every reveal — right or wrong, this is
  // a speed mode, so momentum doesn't stop for a manual "Next" click.
  useEffect(() => {
    if (state.status !== 'revealed') return
    const timer = setTimeout(() => dispatch({ type: 'ADVANCE' }), TIME_TRIAL_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [state.status])

  // Ticks the displayed clock while the trial is running; frozen the moment
  // finishedAt is set so the displayed time always matches the persisted one.
  useEffect(() => {
    if (state.startedAt === null || state.finishedAt !== null) return
    const interval = setInterval(() => setDisplayNow(Date.now()), 100)
    return () => clearInterval(interval)
  }, [state.startedAt, state.finishedAt])

  // Reports the finished trial exactly once. Keyed on finishedAt (a fresh
  // timestamp every trial, null between trials) rather than a ref, so a
  // Retry's new trial naturally reports again without extra bookkeeping.
  useEffect(() => {
    if (state.status !== 'finished' || state.finishedAt === null || state.startedAt === null) return
    const correct = state.results.filter((result) => result.correct).length
    const elapsedMs = state.finishedAt - state.startedAt
    onFinish({ generation, correct, elapsedMs, rank: rankTimeTrial(correct, elapsedMs) })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only finishedAt identifies a new report-worthy finish
  }, [state.status, state.finishedAt])

  if (state.status === 'finished') {
    const correct = state.results.filter((result) => result.correct).length
    const elapsedMs = (state.finishedAt ?? 0) - (state.startedAt ?? 0)
    const rank = rankTimeTrial(correct, elapsedMs)
    return (
      <TimeTrialResults
        rank={rank}
        elapsedMs={elapsedMs}
        correct={correct}
        totalRounds={state.rounds.length}
        results={state.results}
        isNewBest={isBetterTimeTrialResult({ rank, elapsedMs, correct }, personalBest)}
        onRetry={() => dispatch({ type: 'START', rng, generation, includeVariants })}
        onMainMenu={onExit}
      />
    )
  }

  if (state.status === 'preparing') return <Preparing />

  const currentRound = state.rounds[state.roundIndex]
  const elapsedMs = state.startedAt === null ? 0 : displayNow - state.startedAt

  return (
    <>
      <div className="mb-4">
        <TimeTrialProgress roundIndex={state.roundIndex} totalRounds={state.rounds.length} elapsedMs={elapsedMs} />
      </div>
      <RoundView
        mounted={true}
        pokemonId={currentRound.pokemonId}
        roundId={state.roundId}
        status={state.status}
        options={currentRound.options}
        guess={state.guess}
        onReady={() => dispatch({ type: 'IMAGE_READY' })}
        onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId, now: Date.now() })}
      />
    </>
  )
}

export default TimeTrialGame
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- components/TimeTrialGame.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/TimeTrialGame.tsx components/TimeTrialGame.test.tsx
git commit -m "Add TimeTrialGame: preload, timing, auto-advance, and results"
```

---

## Task 9: `MainMenu` — two-button split and the Challenges screen

**Files:**
- Modify: `components/MainMenu.tsx`
- Modify: `components/MainMenu.test.tsx`

**Interfaces:**
- Consumes: `RankBadge` (Task 5); `formatElapsedMs` from `@/lib/timeTrial`; `type TimeTrialBest` from `@/lib/timeTrial`.
- Produces: `MainMenu`'s `mode` prop grows `'challenges'`; new props `onPlayFullDex: () => void`, `onPlayTimeTrial: () => void`, `onContinue: () => void` (replacing `onPlay`), `onShowChallenges: () => void`, `challengesRows: ChallengeRow[]`; new exported `type ChallengeRow = { key: string; label: string; best: TimeTrialBest | null; attempts: number }`.

- [ ] **Step 1: Write the failing tests**

In `components/MainMenu.test.tsx`:

1. Replace the `baseProps` object with:

```tsx
const challengesRows = [
  { key: "all", label: "All generations", best: null, attempts: 0 },
  { key: "1", label: "Generation 1 · Kanto", best: null, attempts: 0 },
];

const baseProps = {
  mode: "menu" as const,
  statsRows,
  challengesRows,
  canContinue: false,
  streak: 0,
  generation: "all" as GenerationFilter,
  generationOptions,
  onGenerationChange: vi.fn<(generation: GenerationFilter) => void>(),
  includeVariants: false,
  onIncludeVariantsChange: vi.fn<(includeVariants: boolean) => void>(),
  onPlayFullDex: vi.fn<() => void>(),
  onPlayTimeTrial: vi.fn<() => void>(),
  onContinue: vi.fn<() => void>(),
  onStartAgain: vi.fn<() => void>(),
  onShowStats: vi.fn<() => void>(),
  onShowChallenges: vi.fn<() => void>(),
};
```

2. Replace the `'shows the title and Play/Stats actions...'` test with:

```tsx
  it("shows the title and Full Dex/Time Trial/Stats/Challenges actions when no run is in progress", () => {
    render(<MainMenu {...baseProps} />);

    expect(
      screen.getByRole("heading", { name: "Pokéguess" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full Dex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Time Trial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stats" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Challenges" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start again" }),
    ).not.toBeInTheDocument();
  });
```

3. Replace `'calls onPlay when Play is clicked'` with:

```tsx
  it("calls onPlayFullDex when Full Dex is clicked", async () => {
    const user = userEvent.setup();
    const onPlayFullDex = vi.fn<() => void>();
    render(<MainMenu {...baseProps} onPlayFullDex={onPlayFullDex} />);

    await user.click(screen.getByRole("button", { name: "Full Dex" }));
    expect(onPlayFullDex).toHaveBeenCalledOnce();
  });

  it("calls onPlayTimeTrial when Time Trial is clicked", async () => {
    const user = userEvent.setup();
    const onPlayTimeTrial = vi.fn<() => void>();
    render(<MainMenu {...baseProps} onPlayTimeTrial={onPlayTimeTrial} />);

    await user.click(screen.getByRole("button", { name: "Time Trial" }));
    expect(onPlayTimeTrial).toHaveBeenCalledOnce();
  });
```

4. Replace `'shows Continue and Start again instead of Play...'`'s assertions to also check Time Trial is hidden, and replace `'calls onPlay when Continue is clicked'` with `onContinue`:

```tsx
  it("shows Continue and Start again instead of Full Dex/Time Trial when a run is in progress", () => {
    render(<MainMenu {...baseProps} canContinue={true} />);

    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start again" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Full Dex" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Time Trial" }),
    ).not.toBeInTheDocument();
  });

  it("calls onContinue when Continue is clicked", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn<() => void>();
    render(<MainMenu {...baseProps} canContinue={true} onContinue={onContinue} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
```

5. Replace `'no longer renders its own Back button...'` test's `mode="stats"` render with an additional check that it also applies to `mode="challenges"`, and add new tests at the end of the file (before the closing `});`):

```tsx
  it("calls onShowChallenges when Challenges is clicked", async () => {
    const user = userEvent.setup();
    const onShowChallenges = vi.fn<() => void>();
    render(<MainMenu {...baseProps} onShowChallenges={onShowChallenges} />);

    await user.click(screen.getByRole("button", { name: "Challenges" }));
    expect(onShowChallenges).toHaveBeenCalledOnce();
  });

  it('shows a "Challenges" heading instead of the title/subtitle in challenges mode', () => {
    render(<MainMenu {...baseProps} mode="challenges" />);

    expect(
      screen.getByRole("heading", { name: "Challenges" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pokéguess" }),
    ).not.toBeInTheDocument();
  });

  it("shows a rank, time and attempt count per generation with a personal best", () => {
    render(
      <MainMenu
        {...baseProps}
        mode="challenges"
        challengesRows={[
          { key: "all", label: "All generations", best: { rank: "A", elapsedMs: 42300, correct: 10 }, attempts: 5 },
          { key: "1", label: "Generation 1 · Kanto", best: null, attempts: 0 },
        ]}
      />,
    );

    expect(screen.getByText("All generations")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("0:42.3")).toBeInTheDocument();
    expect(screen.getByText("Played 5 times")).toBeInTheDocument();

    expect(screen.getByText("Generation 1 · Kanto")).toBeInTheDocument();
    expect(screen.getByText("Not played yet")).toBeInTheDocument();
  });

  it("does not render Play/Stats actions in challenges mode", () => {
    render(<MainMenu {...baseProps} mode="challenges" />);

    expect(screen.queryByRole("button", { name: "Full Dex" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stats" })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- components/MainMenu.test.tsx`
Expected: FAIL — `MainMenu` doesn't yet accept the new props/mode.

- [ ] **Step 3: Update `components/MainMenu.tsx`**

Replace the entire file with:

```tsx
import { ChevronDown, Play, RotateCcw, Swords, Timer, Trophy } from 'lucide-react'

import RankBadge from './RankBadge'
import ScreenHeader from './ScreenHeader'
import type { GenerationFilter } from '@/lib/generations'
import { formatElapsedMs, type TimeTrialBest } from '@/lib/timeTrial'

const primaryButtonClassName =
  'bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const secondaryButtonClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell enabled:hover:bg-screen-sunk flex w-full select-none items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

// Rendered only when no run is in progress (see the canContinue branch
// below), so neither this nor the checkbox below it needs disabled: styling
// — they're never shown in a disabled state.
const selectClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell hover:border-shell w-full cursor-pointer appearance-none rounded-lg border-2 py-2.5 pr-9 pl-3 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none'

// One row per generation (plus "All") for the stats screen. Computed by
// Game.tsx from localStorage, since that's where the per-generation values
// live — MainMenu just renders whatever rows it's handed. `total` is the
// generation's base-species pool size, the denominator for "value/total";
// value >= total means every Pokémon in that pool has been named.
export type StatsRow = { key: string; label: string; value: number | null; total: number }

// One row per generation (plus "All") for the Challenges screen, same shape
// as StatsRow but tracking Time Trial's personal best and attempt count
// instead of a streak.
export type ChallengeRow = { key: string; label: string; best: TimeTrialBest | null; attempts: number }

type GenerationOption = { value: GenerationFilter; label: string }

type Props = {
  mode: 'menu' | 'stats' | 'challenges'
  statsRows: StatsRow[]
  challengesRows: ChallengeRow[]
  // Whether a run is currently in progress (streak > 0), restored from
  // localStorage the same way bestStreak is — see components/Game.tsx.
  // Swaps the generation/variants picker for a "current run" summary and the
  // Full Dex/Time Trial buttons for Continue + Start again. Time Trial has
  // no equivalent "current run" state to resume, so it's simply unavailable
  // until the Full Dex run in progress ends or is reset.
  canContinue: boolean
  // The active run's streak, shown in the "current run" summary while
  // canContinue is true. Unused otherwise.
  streak: number
  generation: GenerationFilter
  generationOptions: readonly GenerationOption[]
  onGenerationChange: (generation: GenerationFilter) => void
  // Whether Mega Evolutions, regional forms and Gigantamax forms are in the
  // draw pool at all. Independent of `generation`: a form is scoped to
  // whichever generation introduced that specific form (e.g. Mega Charizard X
  // is Generation 6), not its base species', so this needs its own control
  // rather than being implied by the generation pick.
  includeVariants: boolean
  onIncludeVariantsChange: (includeVariants: boolean) => void
  onPlayFullDex: () => void
  onPlayTimeTrial: () => void
  onContinue: () => void
  onStartAgain: () => void
  onShowStats: () => void
  onShowChallenges: () => void
}

const MainMenu = ({
  mode,
  statsRows,
  challengesRows,
  canContinue,
  streak,
  generation,
  generationOptions,
  onGenerationChange,
  includeVariants,
  onIncludeVariantsChange,
  onPlayFullDex,
  onPlayTimeTrial,
  onContinue,
  onStartAgain,
  onShowStats,
  onShowChallenges,
}: Props) => {
  const currentGenerationLabel =
    generationOptions.find((option) => option.value === generation)?.label ?? 'All generations'

  return (
    <div className={`flex flex-col items-center gap-6 text-center ${mode === 'menu' ? 'py-10' : 'pt-1 pb-6'}`}>
      {mode === 'menu' ? (
        <ScreenHeader title="Pokéguess" subtitle="Who's that Pokémon?" />
      ) : (
        // Replaces the title/subtitle above (this screen has its own Back
        // button in PokedexShell's corner, not here) — sits close to the top
        // rather than inheriting the menu's centered, py-10 feel.
        <ScreenHeader title={mode === 'stats' ? 'Stats' : 'Challenges'} size="small" />
      )}

      {mode === 'menu' ? (
        <div className="flex w-full flex-col gap-4">
          {canContinue ? (
            <div className="text-left">
              <p className="text-ink-soft mb-1 text-xs font-medium">Current run</p>
              <div className="bg-screen-sunk flex items-center justify-between gap-3 rounded-xl px-4 py-3">
                <div>
                  <p className="text-ink text-sm font-semibold">{currentGenerationLabel}</p>
                  {includeVariants && (
                    <p className="text-ink-soft text-xs">Includes Mega, regional & Gigantamax forms</p>
                  )}
                </div>
                <p className="text-ink-soft shrink-0 text-xs font-medium">
                  Streak <span className="text-ink font-semibold tabular-nums">{streak}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-left">
              <label htmlFor="generation" className="text-ink-soft mb-1 block text-xs font-medium">
                Generation
              </label>
              <div className="relative">
                <select
                  id="generation"
                  value={String(generation)}
                  onChange={(event) => {
                    const raw = event.target.value
                    onGenerationChange(raw === 'all' ? 'all' : Number(raw))
                  }}
                  className={selectClassName}
                >
                  {generationOptions.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="text-ink-soft pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
              </div>
              <label htmlFor="includeVariants" className="text-ink mt-3 flex items-start gap-2 text-xs font-medium">
                <input
                  id="includeVariants"
                  type="checkbox"
                  checked={includeVariants}
                  onChange={(event) => onIncludeVariantsChange(event.target.checked)}
                  className="accent-shell border-screen-sunk focus-visible:ring-shell size-4 shrink-0 cursor-pointer rounded border-2 focus-visible:ring-2 focus-visible:outline-none"
                />
                <span>Include Mega Evolutions, regional & Gigantamax forms</span>
              </label>
            </div>
          )}

          <div className="flex w-full flex-col gap-2">
            {canContinue ? (
              <>
                <button type="button" onClick={onContinue} className={primaryButtonClassName}>
                  <Play className="size-4" aria-hidden="true" />
                  Continue
                </button>
                <button type="button" onClick={onStartAgain} className={secondaryButtonClassName}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Start again
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onPlayFullDex} className={primaryButtonClassName}>
                  <Play className="size-4" aria-hidden="true" />
                  Full Dex
                </button>
                <button type="button" onClick={onPlayTimeTrial} className={primaryButtonClassName}>
                  <Timer className="size-4" aria-hidden="true" />
                  Time Trial
                </button>
              </>
            )}
            <button type="button" onClick={onShowStats} className={secondaryButtonClassName}>
              <Trophy className="size-4" aria-hidden="true" />
              Stats
            </button>
            <button type="button" onClick={onShowChallenges} className={secondaryButtonClassName}>
              <Swords className="size-4" aria-hidden="true" />
              Challenges
            </button>
          </div>
        </div>
      ) : mode === 'stats' ? (
        <div className="flex w-full flex-col gap-2">
          {statsRows.map((row) => {
            // Same amber "new best" treatment RunRecap and the win screen
            // use (bg-best/40 + border-lamp-amber): the generation where the
            // player has named every Pokémon in its pool gets the trophy and
            // the nicer border, and drops the "/total" since the value and
            // the total are the same number.
            const gotThemAll = row.value !== null && row.value >= row.total
            return (
              <div
                key={row.key}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  gotThemAll ? 'bg-best/40 border-lamp-amber border-2' : 'bg-screen-sunk border-2 border-transparent'
                }`}
              >
                <p className="text-ink-soft text-xs font-medium">{row.label}</p>
                <div className="flex items-center gap-1.5">
                  {gotThemAll && <Trophy className="text-best-ink size-4" aria-hidden="true" />}
                  {/* tabular-nums so a row's width doesn't jump as the value changes. */}
                  <p
                    className={`text-lg font-semibold tabular-nums ${gotThemAll ? 'text-best-ink' : 'text-ink-strong'}`}
                  >
                    {row.value === null ? `—/${row.total}` : gotThemAll ? row.total : `${row.value}/${row.total}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {challengesRows.map((row) => (
            <div
              key={row.key}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                row.best?.rank === 'S' ? 'bg-best/40 border-lamp-amber border-2' : 'bg-screen-sunk border-2 border-transparent'
              }`}
            >
              <div className="text-left">
                <p className="text-ink-soft text-xs font-medium">{row.label}</p>
                <p className="text-ink-soft mt-0.5 text-xs">
                  {row.attempts === 0 ? 'Not played yet' : `Played ${row.attempts} time${row.attempts === 1 ? '' : 's'}`}
                </p>
              </div>
              {row.best ? (
                <div className="flex items-center gap-2">
                  <RankBadge rank={row.best.rank} />
                  <p className="text-ink-strong text-sm font-semibold tabular-nums">
                    {formatElapsedMs(row.best.elapsedMs)}
                  </p>
                </div>
              ) : (
                <p className="text-ink-soft text-lg font-semibold">—</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MainMenu
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- components/MainMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/MainMenu.tsx components/MainMenu.test.tsx
git commit -m "Split Play into Full Dex/Time Trial and add the Challenges screen to MainMenu"
```

---

## Task 10: Wire it all together in `Game.tsx`

**Files:**
- Modify: `components/Game.tsx`
- Modify: `components/Game.test.tsx`

**Interfaces:**
- Consumes: `TimeTrialGame` (Task 8), `MainMenu`'s new props/mode (Task 9), `isBetterTimeTrialResult`, `type TimeTrialBest` from `@/lib/timeTrial`, `type TimeTrialRank` from `@/lib/gameConfig`.

- [ ] **Step 1: Update `Game.test.tsx` for the renamed Play button**

The single "Play" button is now "Full Dex" (Time Trial is a separate button). Every test in `components/Game.test.tsx` reaches the game screen through the `renderGame()` helper, so most of the file needs no per-test changes — only the helper and the handful of direct `'Play'` assertions do.

1. Update the `renderGame` helper's regex:

```ts
const renderGame = async (): Promise<UserEvent> => {
  const user = userEvent.setup()
  render(<Game />)
  await user.click(screen.getByRole('button', { name: /^(Full Dex|Continue)$/ }))
  return user
}
```

2. Replace every remaining literal `{ name: 'Play' }` in the file with `{ name: 'Full Dex' }` (there are 9 more occurrences — in `'opens on the main menu, not the game'`, `'shows the best streak on the stats screen...'`, `'returns to the menu on Home...'`, `'resets the run without leaving the menu...'`, and four occurrences inside the `'Generation selection'`/`'Include variants'` describe blocks). Use a project-wide find-and-replace scoped to this file for `'Play'` → `'Full Dex'` inside `{ name: ... }` matchers — do not touch the file's prose/comments.

- [ ] **Step 2: Add new navigation tests**

Append to `components/Game.test.tsx`, inside the top-level `describe('Game', ...)` block (after the existing win-screen test, before its closing `})`):

```ts
  it('opens the Challenges screen and returns to the menu on Back', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: 'Challenges' }))
    expect(screen.getByRole('heading', { name: 'Challenges' })).toBeInTheDocument()
    expect(screen.getByText('Not played yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Pokéguess' })).toBeInTheDocument()
  })

  it('opens Time Trial from the menu, showing its own heading and Home button', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: 'Time Trial' }))
    expect(screen.getByRole('heading', { name: 'Time Trial' })).toBeInTheDocument()
    expect(screen.getByText('All generations')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('heading', { name: 'Pokéguess' })).toBeInTheDocument()
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- components/Game.test.tsx`
Expected: FAIL — `Game.tsx` doesn't yet render "Time Trial"/"Challenges" buttons or the new screens.

- [ ] **Step 4: Update `components/Game.tsx`**

Replace the entire file with:

```tsx
'use client'

import { ArrowLeft, Home, Trophy } from 'lucide-react'
import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react'

import MainMenu, { type ChallengeRow, type StatsRow } from './MainMenu'
import PokedexShell from './PokedexShell'
import RoundView from './RoundView'
import RunRecap from './RunRecap'
import ScoreBoard from './ScoreBoard'
import ScreenHeader from './ScreenHeader'
import TimeTrialGame from './TimeTrialGame'
import { createInitialState, gameReducer, type Rng } from '@/lib/game'
import {
  GENERATION_SELECT_OPTIONS,
  parseGenerationFilter,
  pokemonPoolFor,
  type GenerationFilter,
} from '@/lib/generations'
import { getPokemonName } from '@/lib/pokemon'
import { isBetterTimeTrialResult, type TimeTrialBest } from '@/lib/timeTrial'
import type { TimeTrialRank } from '@/lib/gameConfig'

const BEST_STREAK_KEY = 'bestStreak'
const STREAK_KEY = 'streak'
const USED_IDS_KEY = 'usedIds'
const SELECTED_GENERATION_KEY = 'selectedGeneration'
const INCLUDE_VARIANTS_KEY = 'includeVariants'
const TIME_TRIAL_BEST_KEY = 'timeTrialBest'
const TIME_TRIAL_ATTEMPTS_KEY = 'timeTrialAttempts'
const rng: Rng = () => Math.random()

// 'all' keeps the pre-existing plain 'bestStreak' key so upgrading doesn't
// lose anyone's saved progress; every other generation gets its own key so
// each has an independent best streak. timeTrialBest/timeTrialAttempts follow
// the exact same convention, kept per generation only (not per
// includeVariants) — see lib/generations.ts's pokemonPoolFor and the
// bestStreak precedent this mirrors.
const bestStreakKey = (generation: GenerationFilter): string =>
  generation === 'all' ? BEST_STREAK_KEY : `${BEST_STREAK_KEY}:gen${generation}`

const timeTrialBestKey = (generation: GenerationFilter): string =>
  generation === 'all' ? TIME_TRIAL_BEST_KEY : `${TIME_TRIAL_BEST_KEY}:gen${generation}`

const timeTrialAttemptsKey = (generation: GenerationFilter): string =>
  generation === 'all' ? TIME_TRIAL_ATTEMPTS_KEY : `${TIME_TRIAL_ATTEMPTS_KEY}:gen${generation}`

// Shared by the game screen's header subtitle and RunRecap's missedGuess
// prop, so the two never describe the active run's pool differently.
const generationLabelFor = (generation: GenerationFilter): string =>
  GENERATION_SELECT_OPTIONS.find((option) => option.value === generation)?.label ?? 'All generations'

// Same amber "new best" treatment RunRecap uses for isNewBest (bg-best/40 +
// border-lamp-amber), since clearing every Pokémon in the pool is always at
// least as notable as a new streak record.
const WinScreen = ({ streak }: { streak: number }) => (
  <div className="bg-best/40 border-lamp-amber mb-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 px-6 py-16 text-center">
    <Trophy className="text-best-ink size-10" aria-hidden="true" />
    <p className="text-best-ink text-base font-semibold">You caught &apos;em all!</p>
    <p className="text-ink-soft text-sm">Final streak: {streak}</p>
  </div>
)

const emptySubscribe = () => () => {}

// SSR-safe mount detection: the server snapshot is always `false`, and the
// client snapshot is always `true`, so this reads `false` on the server and
// on the client's very first (hydrating) render, then flips to `true` once
// React commits on the client — without calling setState from an effect.
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false)

const Game = () => {
  const [state, dispatch] = useReducer(gameReducer, rng, createInitialState)
  const mounted = useMounted()
  // Navigation between the main menu, its stats/challenges views, Full Dex
  // Play, and Time Trial. Deliberately plain state rather than part of
  // GameState: it's screen routing, not round logic, and 'menu' on both
  // server and client renders the same way, so it carries none of the
  // hydration risk state.pokemonId and state.options do.
  const [view, setView] = useState<'menu' | 'stats' | 'game' | 'timeTrial' | 'challenges'>('menu')
  // The menu's generation picker. Plain state like `view`, not part of
  // GameState: it's the pre-game pick, only "committed" into the reducer (via
  // SET_GENERATION) when a fresh Full Dex run actually starts — see
  // startRun below. Time Trial reads it directly as a prop instead, since a
  // trial never touches the Full Dex reducer at all. Defaults to 'all' on
  // both server and client, so it carries none of the hydration risk
  // state.pokemonId/state.options do.
  const [selectedGeneration, setSelectedGeneration] = useState<GenerationFilter>('all')
  // Whether Mega/regional/Gigantamax forms are in the draw pool, alongside
  // `selectedGeneration` — same "pre-game pick" pattern, same default-false
  // on both server and client. Independent of the generation pick since a
  // form's own generation (when it was introduced) can differ from its base
  // species' — see lib/generations.ts's pokemonPoolFor.
  const [includeVariants, setIncludeVariants] = useState(false)
  // Best streak per generation ('all' included), read from localStorage for
  // the stats screen. Keyed by String(GenerationFilter) since object keys are
  // always strings.
  const [allBestStreaks, setAllBestStreaks] = useState<Record<string, number>>({})
  // Time Trial's personal best + attempt count per generation, read from
  // localStorage for the Challenges screen and passed into TimeTrialGame so
  // it can tell whether a just-finished trial set a new record.
  const [challengesData, setChallengesData] = useState<Record<string, { best: TimeTrialBest | null; attempts: number }>>(
    {},
  )

  useEffect(() => {
    try {
      const hydratedGeneration = parseGenerationFilter(localStorage.getItem(SELECTED_GENERATION_KEY))
      setSelectedGeneration(hydratedGeneration)
      const hydratedIncludeVariants = localStorage.getItem(INCLUDE_VARIANTS_KEY) === 'true'
      setIncludeVariants(hydratedIncludeVariants)

      const bestStreaks: Record<string, number> = {}
      for (const option of GENERATION_SELECT_OPTIONS) {
        const stored = Number(localStorage.getItem(bestStreakKey(option.value)))
        if (Number.isFinite(stored) && stored > 0) bestStreaks[String(option.value)] = Math.floor(stored)
      }
      setAllBestStreaks(bestStreaks)

      const hydratedBest = bestStreaks[String(hydratedGeneration)]
      if (hydratedBest !== undefined) {
        dispatch({ type: 'HYDRATE_BEST', bestStreak: hydratedBest })
      }

      const storedStreak = Number(localStorage.getItem(STREAK_KEY))
      const storedUsedIds: unknown = JSON.parse(localStorage.getItem(USED_IDS_KEY) ?? '[]')
      if (
        Number.isFinite(storedStreak) &&
        storedStreak > 0 &&
        Array.isArray(storedUsedIds) &&
        storedUsedIds.length > 0 &&
        storedUsedIds.every((id) => typeof id === 'number')
      ) {
        dispatch({
          type: 'HYDRATE_RUN',
          rng,
          streak: Math.floor(storedStreak),
          usedIds: new Set(storedUsedIds),
          generation: hydratedGeneration,
          includeVariants: hydratedIncludeVariants,
        })
      }
    } catch {
      // localStorage can throw (e.g. SecurityError when site data is
      // blocked), or the stored usedIds can fail to parse; the game is still
      // playable without a restored run.
    }
  }, [])

  // Reads every generation's Time Trial personal best + attempt count, kept
  // as its own effect (separate from the Full Dex hydration above) since it's
  // an unrelated concern with its own best-effort try/catch.
  useEffect(() => {
    try {
      const challenges: Record<string, { best: TimeTrialBest | null; attempts: number }> = {}
      for (const option of GENERATION_SELECT_OPTIONS) {
        const attemptsRaw = Number(localStorage.getItem(timeTrialAttemptsKey(option.value)))
        const attempts = Number.isFinite(attemptsRaw) && attemptsRaw > 0 ? Math.floor(attemptsRaw) : 0

        let best: TimeTrialBest | null = null
        const storedBest: unknown = JSON.parse(localStorage.getItem(timeTrialBestKey(option.value)) ?? 'null')
        if (
          storedBest !== null &&
          typeof storedBest === 'object' &&
          'rank' in storedBest &&
          'elapsedMs' in storedBest &&
          'correct' in storedBest
        ) {
          best = storedBest as TimeTrialBest
        }
        challenges[String(option.value)] = { best, attempts }
      }
      setChallengesData(challenges)
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [])

  useEffect(() => {
    if (state.bestStreak !== null) {
      try {
        localStorage.setItem(bestStreakKey(state.generation), String(state.bestStreak))
        setAllBestStreaks((prev) => ({ ...prev, [String(state.generation)]: state.bestStreak as number }))
      } catch {
        // See the read effect above: persistence is best-effort.
      }
    }
  }, [state.bestStreak, state.generation])

  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, String(state.streak))
      localStorage.setItem(USED_IDS_KEY, JSON.stringify([...state.usedIds]))
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [state.streak, state.usedIds])

  // Persisted on every pick (not just when a run starts) so a refresh before
  // clicking Full Dex/Time Trial remembers it, and so HYDRATE_RUN above can
  // tell which pool a restored run was drawn from — the dropdown is locked
  // (see MainMenu) whenever a run is in progress, so this key always matches
  // the active run's generation once one exists.
  const handleGenerationChange = useCallback((generation: GenerationFilter) => {
    setSelectedGeneration(generation)
    try {
      localStorage.setItem(SELECTED_GENERATION_KEY, String(generation))
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [])

  const handleIncludeVariantsChange = useCallback((next: boolean) => {
    setIncludeVariants(next)
    try {
      localStorage.setItem(INCLUDE_VARIANTS_KEY, String(next))
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [])

  const startRun = useCallback(
    (generation: GenerationFilter, includeVariantsPick: boolean) => {
      dispatch({
        type: 'SET_GENERATION',
        rng,
        generation,
        includeVariants: includeVariantsPick,
        bestStreak: allBestStreaks[String(generation)] ?? null,
      })
      setView('game')
    },
    [allBestStreaks],
  )

  // Reported once by TimeTrialGame when a trial finishes. Compares against
  // the stored personal best, writes if it's better, always increments the
  // attempts counter, and updates challengesData so the Challenges screen
  // reflects the new result immediately without a reload.
  const handleTimeTrialFinish = useCallback(
    (result: { generation: GenerationFilter; correct: number; elapsedMs: number; rank: TimeTrialRank }) => {
      const key = String(result.generation)
      const candidate: TimeTrialBest = { rank: result.rank, elapsedMs: result.elapsedMs, correct: result.correct }
      setChallengesData((prev) => {
        const current = prev[key] ?? { best: null, attempts: 0 }
        const best = isBetterTimeTrialResult(candidate, current.best) ? candidate : current.best
        const attempts = current.attempts + 1
        try {
          localStorage.setItem(timeTrialBestKey(result.generation), JSON.stringify(best))
          localStorage.setItem(timeTrialAttemptsKey(result.generation), String(attempts))
        } catch {
          // See the read effect above: persistence is best-effort.
        }
        return { ...prev, [key]: { best, attempts } }
      })
    },
    [],
  )

  // total is the base-species pool size (includeVariants: false) regardless
  // of which pool a given run was actually played with — bestStreak is
  // tracked per generation only, not per includeVariants (see
  // lib/generations.ts's pokemonPoolFor), so the base pool is the one stable
  // denominator every row can compare against.
  const statsRows: StatsRow[] = GENERATION_SELECT_OPTIONS.map((option) => ({
    key: String(option.value),
    label: option.label,
    value: allBestStreaks[String(option.value)] ?? null,
    total: pokemonPoolFor(option.value, false).length,
  }))

  const challengesRows: ChallengeRow[] = GENERATION_SELECT_OPTIONS.map((option) => ({
    key: String(option.value),
    label: option.label,
    best: challengesData[String(option.value)]?.best ?? null,
    attempts: challengesData[String(option.value)]?.attempts ?? 0,
  }))

  const handleReady = useCallback(() => dispatch({ type: 'IMAGE_READY' }), [])
  const revealed = mounted && state.status === 'revealed'
  const won = mounted && state.status === 'won'
  const canAdvance = revealed || won

  // Drives the run-recap screen (see RunRecap) in place of the normal round
  // UI once a wrong guess ends the run. Computed as one value, rather than a
  // separate boolean plus re-reading state.guess at the render site, so
  // TypeScript narrows state.guess (number | null) to number here instead of
  // needing a second null check (or a cast) in the JSX below — revealed with
  // a set guess only ever follows a real GUESS action, so guess is never
  // actually null at this point.
  const missedGuess =
    revealed && state.guess !== null && state.guess !== state.pokemonId
      ? {
          correctEntries: [...state.usedIds]
            .filter((id) => id !== state.pokemonId)
            .map((id) => ({ id, name: getPokemonName(id) })),
          bestStreak: state.bestStreak,
          isNewBest: state.isNewBest,
          missedAnswer: { id: state.pokemonId, name: getPokemonName(state.pokemonId) },
          guessedAnswer: { id: state.guess, name: getPokemonName(state.guess) },
        }
      : null

  // Digits 1-4 mirror clicking an option (matching the on-screen number
  // badges), Space or N mirrors the Next/Start again/Main menu button.
  // Modifier keys are left alone so this doesn't fight browser shortcuts like
  // Cmd+1 for tab switching. Scoped to the 'game' view only — Time Trial has
  // its own auto-advance flow with no equivalent shortcuts.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (view !== 'game' || event.metaKey || event.ctrlKey || event.altKey) return

      if (state.status === 'guessing') {
        const index = Number(event.key) - 1
        if (index < 0 || index > 3) return
        const pokemonId = state.options[index]
        if (pokemonId === undefined) return
        dispatch({ type: 'GUESS', pokemonId })
        return
      }

      if (state.status === 'revealed' || state.status === 'won') {
        const isNext = state.status === 'revealed' && state.guess === state.pokemonId
        if (event.key === ' ' || (isNext && event.key.toLowerCase() === 'n')) {
          event.preventDefault()
          // The win screen's button navigates to the main menu rather than
          // restarting in place — see the button below — so the shortcut
          // that mirrors it does the same instead of dispatching NEXT.
          if (state.status === 'won') {
            setView('menu')
          } else {
            dispatch({ type: 'NEXT', rng })
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, state.status, state.options, state.guess, state.pokemonId])

  if (view === 'game') {
    return (
      <PokedexShell cornerAction={{ icon: Home, label: 'Home', onClick: () => setView('menu') }}>
        {/* The title only appears on the main menu; this is the game screen's
            own heading, with the active run's generation as its subtitle —
            same ScreenHeader used everywhere else, so the two never drift into
            different typography. */}
        <div className="mb-3">
          <ScreenHeader title="Who's that Pokémon?" subtitle={generationLabelFor(state.generation)} size="small" />
        </div>

        {/* Hidden once a run ends on a wrong guess: ScoreBoard's live "Streak"
            already reads 0 by this point (GUESS zeroes it immediately), and
            RunRecap shows both numbers itself — showing both would read as a
            contradiction. Also hidden on the win screen, which shows its own
            "Final streak" — repeating Streak/Best right above it would be the
            same numbers twice on one screen. */}
        {!missedGuess && !won && (
          <div className="mb-4">
            <ScoreBoard streak={state.streak} bestStreak={state.bestStreak} />
          </div>
        )}

        {won ? (
          <WinScreen streak={state.streak} />
        ) : missedGuess ? (
          <RunRecap {...missedGuess} />
        ) : (
          <RoundView
            mounted={mounted}
            pokemonId={state.pokemonId}
            roundId={state.roundId}
            status={state.status}
            options={state.options}
            guess={state.guess}
            onReady={handleReady}
            onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId })}
          />
        )}

        <button
          type="button"
          onClick={() => (won ? setView('menu') : dispatch({ type: 'NEXT', rng }))}
          disabled={!canAdvance}
          className="bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark mt-4 flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99] disabled:cursor-default disabled:opacity-40"
        >
          {/* The Space-bar hint mirrors the guess grid's number badges: same
              bordered box, same "only visible while the shortcut works" rule
              (revealed or won, sm and up), just with an underscore standing in
              for the spacebar. */}
          {canAdvance && (
            <span
              aria-hidden="true"
              className="text-button/40 hidden size-5 shrink-0 items-center justify-center rounded border border-current/40 text-xs font-semibold sm:flex"
            >
              _
            </span>
          )}
          {won ? 'Main menu' : missedGuess ? 'Start again' : 'Next'}
        </button>
      </PokedexShell>
    )
  }

  if (view === 'timeTrial') {
    return (
      <PokedexShell cornerAction={{ icon: Home, label: 'Home', onClick: () => setView('menu') }}>
        <div className="mb-3">
          <ScreenHeader title="Time Trial" subtitle={generationLabelFor(selectedGeneration)} size="small" />
        </div>
        <TimeTrialGame
          generation={selectedGeneration}
          includeVariants={includeVariants}
          personalBest={challengesData[String(selectedGeneration)]?.best ?? null}
          onFinish={handleTimeTrialFinish}
          onExit={() => setView('menu')}
        />
      </PokedexShell>
    )
  }

  return (
    <PokedexShell
      cornerAction={
        view === 'stats' || view === 'challenges'
          ? { icon: ArrowLeft, label: 'Back', onClick: () => setView('menu') }
          : undefined
      }
    >
      <MainMenu
        mode={view}
        statsRows={statsRows}
        challengesRows={challengesRows}
        canContinue={state.streak > 0}
        streak={state.streak}
        generation={selectedGeneration}
        generationOptions={GENERATION_SELECT_OPTIONS}
        onGenerationChange={handleGenerationChange}
        includeVariants={includeVariants}
        onIncludeVariantsChange={handleIncludeVariantsChange}
        onPlayFullDex={() => startRun(selectedGeneration, includeVariants)}
        onPlayTimeTrial={() => setView('timeTrial')}
        onContinue={() => setView('game')}
        onStartAgain={() => dispatch({ type: 'RESTART', rng })}
        onShowStats={() => setView('stats')}
        onShowChallenges={() => setView('challenges')}
      />
    </PokedexShell>
  )
}

export default Game
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- components/Game.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite, lint, and typecheck**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS across the whole project.

- [ ] **Step 7: Commit**

```bash
git add components/Game.tsx components/Game.test.tsx
git commit -m "Wire Time Trial and Challenges into Game.tsx's navigation and persistence"
```

---

## Task 11: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "only stateful component" line**

Find this sentence in the Architecture section:

> **`components/Game.tsx` is the only stateful component.** It owns the reducer
> and composes the presentational components (`GuessGrid`, `GuessButton`,
> `PokemonSilhouette`, `RunRecap`, `ScoreBoard`, `PokedexShell`, `MainMenu`,
> `ScreenHeader`) around it. Those components hold no game state of their own —
> if you find yourself adding `useState` to one of them, the state probably
> belongs in the reducer.

Replace it with:

> **`components/Game.tsx` and `components/TimeTrialGame.tsx` are the two
> stateful components.** `Game.tsx` owns the Full Dex reducer and composes the
> presentational components (`RoundView`, `RunRecap`, `ScoreBoard`,
> `PokedexShell`, `MainMenu`, `ScreenHeader`) around it. `TimeTrialGame.tsx`
> owns a separate reducer (`lib/timeTrial.ts`) for the Time Trial mode — its
> state shape and lifecycle (a fixed 10-round trial with its own preload/
> timer/auto-advance effects) are different enough from `GameState` that
> folding them into one reducer would mean branching most of its cases on
> which mode is active. `RoundView` (the silhouette + revealed name + guess
> grid trio) is shared between the two. Every other component holds no state
> of its own — if you find yourself adding `useState` to one of them, the
> state probably belongs in one of the two reducers.

- [ ] **Step 2: Add a "Time Trial" section**

Insert a new section after "### The run recap screen" and before "### Generation selection":

```markdown
### Time Trial

A second game mode, alongside the endless-streak "Full Dex Play" the rest of
this document describes: a fixed `TIME_TRIAL_ROUND_COUNT` (10) rounds against
the clock, scored into an S/A/B/C/D rank.

`lib/timeTrial.ts` mirrors `lib/game.ts`'s shape — a pure reducer plus
helpers, with `Rng` *and* timestamps passed in explicitly (never
`Math.random`/`Date.now` called internally) so trials stay deterministically
testable. `TimeTrialState.rounds` — all 10 `{ pokemonId, options }` pairs — is
drawn once at `START`, not one round at a time; `ADVANCE` is pure index
bookkeeping into that precomputed array.

Before round 1, `TimeTrialGame` preloads every answer sprite (`new Image()`,
warming the browser cache — distractor options only ever render as text, so
nothing else needs preloading) behind a `'preparing'` status. This is what
keeps round-to-round timing fair: without it, whoever has the faster
connection would get a better time for reasons that have nothing to do with
recognizing the silhouette faster. `TimeTrialState.startedAt` is set only once
preloading resolves (or a `TIME_TRIAL_PRELOAD_FALLBACK_MS` fallback timeout
fires) and round 1 is actually presented — the preload wait itself is never
counted. `finishedAt` is set the instant round 10's `GUESS` is dispatched, not
after that round's reveal pause, so the auto-advance delay never counts either.

Every guess — right or wrong — reveals and then auto-advances after a fixed
`TIME_TRIAL_REVEAL_MS` pause, with no button press: unlike Full Dex Play, a
wrong guess doesn't end the trial early, so momentum shouldn't stop on a
correct guess either.

`rankTimeTrial` (`lib/gameConfig.ts`) computes the rank from mistake count and
elapsed time: mistake count gates the tier (a single miss can never be
outrun into an S or A no matter how fast the rest of the trial was), and
elapsed time only ever breaks the S/A tie within an otherwise-flawless run.
`TIME_TRIAL_HARD_DISTRACTORS` is fixed (currently 0) rather than scaling with
progress the way `DIFFICULTY_CURVE` does for Full Dex Play — see
`generateOptionsWithHardTarget` in `lib/game.ts`, which `generateOptions`
itself is now a thin wrapper around, for the seam that makes this possible
without coupling Time Trial's difficulty to the streak curve.

Time Trial has no in-progress persistence: leaving mid-trial (the Home button)
simply discards it, matching how short a trial is (10 rounds, well under a
minute). A finished trial's result is reported once via `onFinish`, which
`Game.tsx` compares against the stored personal best (`isBetterTimeTrialResult`
— rank first, elapsed time as the tiebreaker within the same rank) before
writing.
```

- [ ] **Step 3: Extend the persistence description**

Find the paragraph beginning "Best streaks are tracked per generation..." in
the "Generation selection" section, and add a new paragraph immediately after
it:

```markdown
Time Trial personal bests follow the exact same per-generation convention —
`timeTrialBest`/`timeTrialBest:gen<N>` (a JSON `{ rank, elapsedMs, correct }`)
and `timeTrialAttempts`/`timeTrialAttempts:gen<N>` (a plain integer,
incremented once per *completed* trial only) — not split by `includeVariants`
either. `Game.tsx` reads both into `challengesData` on mount, the same way it
reads `allBestStreaks`, and the Challenges screen (`MainMenu`'s `'challenges'`
mode) renders one row per generation from it, parallel to how `'stats'` mode
renders `statsRows`.
```

- [ ] **Step 4: Update the `lib/pokemonData.ts` component-file listing**

No changes needed there — that paragraph describes generated Pokémon data,
unrelated to this feature.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Document Time Trial in CLAUDE.md"
```

---

## Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS, every test file green.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS, no warnings.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: PASS — this is the only check that exercises static generation, per CLAUDE.md.

- [ ] **Step 5: Report results**

Summarize pass/fail for each of the four commands above. If everything passes, the feature is ready for the user's own manual pass in the browser (`npm run dev`) — per the user's earlier note, no automated browser verification is needed here, they'll test locally themselves.

No commit for this task — it's verification only, not a code change.
