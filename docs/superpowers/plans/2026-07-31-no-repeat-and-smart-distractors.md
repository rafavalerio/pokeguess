# No-Repeat Answers and Difficulty-Scaled Distractors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A run (unbroken streak) never repeats an answer Pokémon; wrong options get harder — dex-adjacent or similarly-spelled to the answer — the longer the streak runs; and correctly naming every entry in the pool ends the run in a win screen instead of looping forever.

**Architecture:** All three behaviors live inside `lib/game.ts`'s existing pure, synchronous reducer/helpers, with a new sibling config module (`lib/gameConfig.ts`) holding every tunable number (the difficulty ramp, "same family" and "similar spelling" thresholds) so retuning later is a data edit, not a logic change. `components/Game.tsx` gets a `status === 'won'` branch and its existing Space/N keyboard handling extends to cover it.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Vitest. No new dependencies.

**Reference:** [docs/superpowers/specs/2026-07-31-no-repeat-and-smart-distractors-design.md](../specs/2026-07-31-no-repeat-and-smart-distractors-design.md) — read this first for the *why* behind each decision below; this plan is the *how*.

## Global Constraints

- No semicolons, single quotes, 2-space indent — match the surrounding file.
- `@/*` path alias maps to the repo root.
- `lib/` stays pure — no `Math.random` inside it; the `Rng` parameter continues to be threaded through explicitly into every new function that needs randomness.
- Comments explain *why*, not what — only add one where a future reader would otherwise be surprised (per `CLAUDE.md`'s Conventions section).
- `components/Game.test.tsx` queries by role and accessible name; don't change `aria-hidden`, labels, or roles without checking the intent of the existing assertions first.
- Run `npm run lint`, `npm run typecheck`, and `npm test` after every task; run `npm run build` after the final task since it's the only check that exercises static generation and this plan touches `components/Game.tsx`.

---

## Task 1: Centralized difficulty config

**Why this is its own task:** every later task either reads from or is shaped by these numbers. Building it first, standalone and fully tested, means Tasks 2–4 consume a finished, trustworthy module instead of a moving target.

**Files:**
- Create: `lib/gameConfig.ts`
- Create: `lib/gameConfig.test.ts`

**Interfaces:**
- Produces: `DIFFICULTY_CURVE: readonly { minStreak: number; hardDistractors: number }[]`, `DEX_PROXIMITY: number`, `SIMILARITY_THRESHOLD: number`, `hardDistractorCountForStreak(streak: number): number` — all named exports from `lib/gameConfig.ts`. Task 2 imports all four.

- [ ] **Step 1: Write the failing test**

Create `lib/gameConfig.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { DIFFICULTY_CURVE, hardDistractorCountForStreak } from './gameConfig'

describe('hardDistractorCountForStreak', () => {
  it('returns 0 below the first non-zero band', () => {
    expect(hardDistractorCountForStreak(0)).toBe(0)
    expect(hardDistractorCountForStreak(2)).toBe(0)
  })

  it('returns 1 for streak 3 through 7', () => {
    expect(hardDistractorCountForStreak(3)).toBe(1)
    expect(hardDistractorCountForStreak(7)).toBe(1)
  })

  it('returns 2 for streak 8 through 14', () => {
    expect(hardDistractorCountForStreak(8)).toBe(2)
    expect(hardDistractorCountForStreak(14)).toBe(2)
  })

  it('returns 3 for streak 15 and beyond', () => {
    expect(hardDistractorCountForStreak(15)).toBe(3)
    expect(hardDistractorCountForStreak(1000)).toBe(3)
  })

  it('matches DIFFICULTY_CURVE at every band boundary', () => {
    for (const band of DIFFICULTY_CURVE) {
      expect(hardDistractorCountForStreak(band.minStreak)).toBe(band.hardDistractors)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/gameConfig.test.ts`
Expected: FAIL — `lib/gameConfig.ts` does not exist (module not found).

- [ ] **Step 3: Write the implementation**

Create `lib/gameConfig.ts`:

```ts
// Ordered ascending by minStreak; the first band's minStreak must be 0.
// hardDistractorCountForStreak picks the highest band the streak has reached.
export const DIFFICULTY_CURVE: readonly { minStreak: number; hardDistractors: number }[] = [
  { minStreak: 0, hardDistractors: 0 },
  { minStreak: 3, hardDistractors: 1 },
  { minStreak: 8, hardDistractors: 2 },
  { minStreak: 15, hardDistractors: 3 },
]

// |speciesDex_a - speciesDex_b| <= this counts as "same family".
export const DEX_PROXIMITY = 2

// Normalized name-similarity score (0-1) to count as "similar spelling".
export const SIMILARITY_THRESHOLD = 0.5

export const hardDistractorCountForStreak = (streak: number): number => {
  let count = DIFFICULTY_CURVE[0].hardDistractors
  for (const band of DIFFICULTY_CURVE) {
    if (streak < band.minStreak) break
    count = band.hardDistractors
  }
  return count
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/gameConfig.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both clean

- [ ] **Step 6: Commit**

```bash
git add lib/gameConfig.ts lib/gameConfig.test.ts
git commit -m "$(cat <<'EOF'
Add lib/gameConfig.ts for the difficulty ramp and distractor thresholds

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Difficulty-scaled distractors in `generateOptions`

**Files:**
- Modify: `lib/game.ts:1` (imports), `lib/game.ts:8-15` (add helpers after `shuffle`), `lib/game.ts:17-30` (`generateOptions`), `lib/game.ts:50-53` (`startRound`), `lib/game.ts:55-60` (`createInitialState`), `lib/game.ts:90-91` (`NEXT` case)
- Modify: `lib/game.test.ts` (update 5 existing `generateOptions` calls, add new tests)

**Interfaces:**
- Consumes: `hardDistractorCountForStreak`, `DEX_PROXIMITY`, `SIMILARITY_THRESHOLD` from `./gameConfig` (Task 1); `getPokemonEntry(id: number): PokemonEntry` from `./pokemon` (already exists).
- Produces: `generateOptions(answerId: number, streak: number, rng: Rng): number[]` — signature change, `streak` inserted before `rng`. `isHardDistractor(answer: PokemonEntry, candidate: PokemonEntry): boolean` and `spellingSimilarity(nameA: string, nameB: string): number` — new named exports. `startRound(rng: Rng, streak: number)` — internal, signature change (Task 3 extends this again to add a third parameter).

**Why the `hardTarget > 0` guard matters:** at streak 0 (and 1, and 2 — the curve's first band doesn't start until streak 3), `generateOptions` must consume `rng` in *exactly* the same call sequence as it does today, or every existing scripted-`rng` test in `lib/game.test.ts` that expects a specific outcome from a specific sequence of values would silently start seeing different values than it did before. Building the hard-candidate list unconditionally (even when it's immediately discarded because the target is 0) would insert extra `rng()` calls before the existing random-fill loop ever runs. Skipping that phase entirely when `hardTarget` is 0 keeps this task's change fully invisible to every low-streak scenario.

- [ ] **Step 1: Write the failing tests for the new pure helpers and the signature change**

Open `lib/game.test.ts`. Change the import line to also pull in the new exports:

```ts
import { createInitialState, gameReducer, generateOptions, isHardDistractor, randomPokemon, spellingSimilarity, type Rng } from './game'
```

Update the 5 existing `generateOptions` calls to pass `0` as the new streak argument, preserving today's behavior exactly:

```ts
describe('generateOptions', () => {
  it('always includes the answer', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const options = generateOptions(42, 0, makeRng([seed / 50]))
      expect(options).toContain(42)
    }
  })

  it('returns exactly four options', () => {
    expect(generateOptions(42, 0, makeRng([0.1, 0.2, 0.3]))).toHaveLength(4)
  })

  it('never returns duplicates', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const options = generateOptions(42, 0, makeRng([seed / 50]))
      expect(new Set(options).size).toBe(4)
    }
  })

  it('only returns ids that exist in pokemonList', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const option of generateOptions(42, 0, makeRng([seed / 50]))) {
        expect(validIds.has(option)).toBe(true)
      }
    }
  })

  it('makes progress even when the rng keeps returning the answer', () => {
    const answerDraw = 41 / pokemonList.length // resolves to pokemonList[41], id 42
    expect(generateOptions(42, 0, makeRng([answerDraw, 0.5, 0.6, 0.7]))).toHaveLength(4)
  })
})
```

Append new `describe` blocks at the end of the file (after the closing `})` of the existing `describe('gameReducer', ...)` block):

```ts
describe('spellingSimilarity', () => {
  it('scores identical-after-normalizing names as a perfect match', () => {
    // Nidoran♀ / Nidoran♂ normalize to the same string once the gender
    // symbols are stripped.
    expect(spellingSimilarity('Nidoran♀', 'Nidoran♂')).toBe(1)
  })

  it('scores names with no meaningful overlap as low similarity', () => {
    expect(spellingSimilarity('Weedle', 'Kakuna')).toBeLessThan(0.5)
    expect(spellingSimilarity('Bulbasaur', 'Mewtwo')).toBeLessThan(0.5)
  })
})

describe('isHardDistractor', () => {
  const entry = (id: number) => pokemonList.find((e) => e.id === id)!
  const weedle = entry(13)
  const kakuna = entry(14)
  const nidoranFemale = entry(29)
  const nidoranMale = entry(32)
  const bulbasaur = entry(1)
  const mewtwo = entry(150)

  it('is true for dex-adjacent entries even with dissimilar names', () => {
    expect(isHardDistractor(kakuna, weedle)).toBe(true)
  })

  it('is true for similarly-spelled entries even when far apart in the dex', () => {
    expect(Math.abs(nidoranFemale.speciesDex - nidoranMale.speciesDex)).toBeGreaterThan(2)
    expect(isHardDistractor(nidoranFemale, nidoranMale)).toBe(true)
  })

  it('is false when neither signal matches', () => {
    expect(isHardDistractor(bulbasaur, mewtwo)).toBe(false)
  })
})

describe('generateOptions scales hard distractors with streak', () => {
  const kakunaId = 14 // dex 14; Butterfree(12)/Weedle(13)/Beedrill(15)/Pidgey(16) are all dex-adjacent hard candidates
  const kakuna = pokemonList.find((entry) => entry.id === kakunaId)!
  const hardCountIn = (options: number[]) =>
    options.filter(
      (id) => id !== kakunaId && isHardDistractor(kakuna, pokemonList.find((entry) => entry.id === id)!),
    ).length

  it('always includes at least one hard distractor once the streak reaches the first band (3-7)', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const options = generateOptions(kakunaId, 3, makeRng([seed / 20, 0.11, 0.22, 0.33, 0.44]))
      expect(hardCountIn(options)).toBeGreaterThanOrEqual(1)
    }
  })

  it('always includes at least two hard distractors once the streak reaches the second band (8-14)', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const options = generateOptions(kakunaId, 8, makeRng([seed / 20, 0.11, 0.22, 0.33, 0.44]))
      expect(hardCountIn(options)).toBeGreaterThanOrEqual(2)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/game.test.ts`
Expected: FAIL — `isHardDistractor` and `spellingSimilarity` are not exported from `./game`; `generateOptions` calls now pass the wrong number of arguments to the current (2-arg) signature.

- [ ] **Step 3: Write the implementation**

In `lib/game.ts`, change the import line at the top:

```ts
import { DEX_PROXIMITY, SIMILARITY_THRESHOLD, hardDistractorCountForStreak } from './gameConfig'
import { getPokemonEntry } from './pokemon'
import { pokemonList, type PokemonEntry } from './pokemonData'
```

Insert these helpers immediately after the existing `shuffle` function (before `generateOptions`):

```ts
const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (Flabébé -> flabebe)
    .replace(/[^a-z0-9]/gi, '') // strip spaces, punctuation, gender symbols
    .toLowerCase()

const levenshteinDistance = (a: string, b: string): number => {
  const rows = a.length + 1
  const cols = b.length + 1
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0))
  for (let i = 0; i < rows; i += 1) dp[i][0] = i
  for (let j = 0; j < cols; j += 1) dp[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[rows - 1][cols - 1]
}

export const spellingSimilarity = (nameA: string, nameB: string): number => {
  const a = normalizeName(nameA)
  const b = normalizeName(nameB)
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 0 : 1 - levenshteinDistance(a, b) / maxLen
}

export const isHardDistractor = (answer: PokemonEntry, candidate: PokemonEntry): boolean =>
  Math.abs(answer.speciesDex - candidate.speciesDex) <= DEX_PROXIMITY ||
  spellingSimilarity(answer.name, candidate.name) >= SIMILARITY_THRESHOLD
```

Replace `generateOptions`:

```ts
export const generateOptions = (answerId: number, streak: number, rng: Rng): number[] => {
  const answer = getPokemonEntry(answerId)
  const hardTarget = hardDistractorCountForStreak(streak)
  const options = new Set<number>([answerId])

  // Skipped entirely at hardTarget 0 (streak 0-2) so the rng call sequence
  // — and therefore every existing scripted-rng test — is untouched at low
  // streaks. See this task's note above.
  if (hardTarget > 0) {
    const hardCandidates = shuffle(
      pokemonList.filter((entry) => entry.id !== answerId && isHardDistractor(answer, entry)),
      rng,
    )
    for (const candidate of hardCandidates) {
      if (options.size >= 1 + hardTarget) break
      options.add(candidate.id)
    }
  }

  let guard = 0
  while (options.size < 4 && guard < 1000) {
    options.add(randomPokemon(rng).id)
    guard += 1
  }
  let index = 0
  while (options.size < Math.min(4, pokemonList.length)) {
    options.add(pokemonList[index].id)
    index = index >= pokemonList.length - 1 ? 0 : index + 1
  }
  return shuffle([...options], rng)
}
```

Update `startRound` to thread `streak` through, and its two call sites:

```ts
const startRound = (rng: Rng, streak: number): Pick<GameState, 'status' | 'pokemonId' | 'options' | 'guess'> => {
  const pokemonId = randomPokemon(rng).id
  return { status: 'loading', pokemonId, options: generateOptions(pokemonId, streak, rng), guess: null }
}

export const createInitialState = (rng: Rng): GameState => ({
  ...startRound(rng, 0),
  streak: 0,
  bestStreak: null,
  roundId: 0,
})
```

And the `NEXT` case:

```ts
case 'NEXT':
  return { ...state, ...startRound(action.rng, state.streak), roundId: state.roundId + 1 }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/game.test.ts`
Expected: PASS (all tests, including the new ones)

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both clean

- [ ] **Step 6: Commit**

```bash
git add lib/game.ts lib/game.test.ts
git commit -m "$(cat <<'EOF'
Scale distractor difficulty with streak in generateOptions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: No-repeat answers within a run

**Files:**
- Modify: `lib/game.ts` (new `randomPokemonExcluding` after `randomPokemon`; `GameState` gains `usedIds`; `startRound`, `createInitialState`, `NEXT` case all change again)
- Modify: `lib/game.test.ts` (new `describe('no-repeat within a run', ...)`)

**Interfaces:**
- Consumes: `randomPokemon(rng: Rng): PokemonEntry`, `pokemonList` (both already in `lib/game.ts`).
- Produces: `randomPokemonExcluding(rng: Rng, excludeIds: ReadonlySet<number>): PokemonEntry` — new named export. `GameState.usedIds: ReadonlySet<number>` — new field, present on every `GameState` from this task onward. `startRound(rng: Rng, streak: number, usedIds: ReadonlySet<number>)` — internal, signature change (Task 2's 2-arg version becomes 3-arg).

- [ ] **Step 1: Write the failing tests**

In `lib/game.test.ts`, add `randomPokemonExcluding` to the import from `./game` (added in Task 2):

```ts
import { createInitialState, gameReducer, generateOptions, isHardDistractor, randomPokemon, randomPokemonExcluding, spellingSimilarity, type Rng } from './game'
```

Append to `lib/game.test.ts` (after the `describe('generateOptions scales hard distractors with streak', ...)` block added in Task 2):

```ts
describe('randomPokemonExcluding', () => {
  it('never returns an excluded id', () => {
    const excluded = new Set([pokemonList[0].id])
    for (let seed = 0; seed < 20; seed += 1) {
      const result = randomPokemonExcluding(makeRng([seed / 20]), excluded)
      expect(excluded.has(result.id)).toBe(false)
    }
  })

  it('falls back deterministically when the rng keeps landing on an excluded id', () => {
    const pinnedId = pokemonList[Math.floor(0.5 * pokemonList.length)].id
    const excluded = new Set([pinnedId])
    // rng is pinned to 0.5 forever, so every guard-loop attempt lands on the
    // excluded id — this only returns if the deterministic fallback kicks in.
    const result = randomPokemonExcluding(makeRng([0.5]), excluded)
    expect(result.id).not.toBe(pinnedId)
    expect(excluded.has(result.id)).toBe(false)
  })
})

describe('no-repeat within a run', () => {
  const idAt = (rngValue: number) => pokemonList[Math.floor(rngValue * pokemonList.length)].id

  it('excludes the current run\'s drawn ids from the next draw while the streak continues', () => {
    const pinnedId = idAt(0.5)
    let state = createInitialState(makeRng([0.5]))
    expect(state.pokemonId).toBe(pinnedId)
    expect(state.usedIds.has(pinnedId)).toBe(true)

    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // correct, streak 1
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    // rng always resolves to pinnedId; since it's already used this run, the
    // draw must fall back to a different entry rather than repeating it.
    expect(state.pokemonId).not.toBe(pinnedId)
    expect(state.usedIds.has(pinnedId)).toBe(true)
    expect(state.usedIds.has(state.pokemonId)).toBe(true)
    expect(state.usedIds.size).toBe(2)
  })

  it('resets the exclusion set once the streak breaks', () => {
    const pinnedId = idAt(0.5)
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, { type: 'IMAGE_READY' })
    const wrong = state.options.find((o) => o !== state.pokemonId)!
    state = gameReducer(state, { type: 'GUESS', pokemonId: wrong }) // wrong, streak 0
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    // The run just restarted, so the exclusion set is empty again and the
    // pinned draw is free to repeat.
    expect(state.pokemonId).toBe(pinnedId)
    expect(state.usedIds.size).toBe(1)
    expect(state.usedIds.has(pinnedId)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/game.test.ts`
Expected: FAIL — `state.usedIds` is `undefined` (`GameState` doesn't have this field yet), and the first test's "must not repeat" assertion fails since nothing excludes it yet.

- [ ] **Step 3: Write the implementation**

In `lib/game.ts`, add `randomPokemonExcluding` immediately after `randomPokemon`:

```ts
export const randomPokemonExcluding = (rng: Rng, excludeIds: ReadonlySet<number>): PokemonEntry => {
  let guard = 0
  let candidate = randomPokemon(rng)
  while (excludeIds.has(candidate.id) && guard < 1000) {
    candidate = randomPokemon(rng)
    guard += 1
  }
  if (!excludeIds.has(candidate.id)) return candidate
  // Guard tripped: an enormous run has nearly exhausted the pool (or a
  // pathological rng). Deterministically wrap to the first still-unused
  // entry so the run keeps going instead of stalling.
  return pokemonList.find((entry) => !excludeIds.has(entry.id)) ?? candidate
}
```

Add `usedIds` to `GameState`:

```ts
export type GameState = {
  status: Status
  pokemonId: number
  options: number[]
  guess: number | null
  streak: number
  bestStreak: number | null
  roundId: number
  // Answers drawn so far in the current unbroken streak ("run"). Cleared
  // whenever a run ends (see the NEXT case) so a fresh run can draw anything
  // again, including a Pokémon just shown in the run that just ended.
  usedIds: ReadonlySet<number>
}
```

Update `startRound` to draw with exclusion, and its call sites:

```ts
const startRound = (
  rng: Rng,
  streak: number,
  usedIds: ReadonlySet<number>,
): Pick<GameState, 'status' | 'pokemonId' | 'options' | 'guess'> => {
  const pokemonId = randomPokemonExcluding(rng, usedIds).id
  return { status: 'loading', pokemonId, options: generateOptions(pokemonId, streak, rng), guess: null }
}

export const createInitialState = (rng: Rng): GameState => {
  const round = startRound(rng, 0, new Set())
  return { ...round, streak: 0, bestStreak: null, roundId: 0, usedIds: new Set([round.pokemonId]) }
}
```

And the `NEXT` case:

```ts
case 'NEXT': {
  const usedIds = state.streak === 0 ? new Set<number>() : state.usedIds
  const round = startRound(action.rng, state.streak, usedIds)
  return { ...state, ...round, usedIds: new Set(usedIds).add(round.pokemonId), roundId: state.roundId + 1 }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/game.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both clean

- [ ] **Step 6: Commit**

```bash
git add lib/game.ts lib/game.test.ts
git commit -m "$(cat <<'EOF'
Exclude previously-drawn answers from the rest of a run

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Winning the game

**Files:**
- Modify: `lib/game.ts` (`Status` gains `'won'`; `NEXT` case gains two more branches)
- Modify: `lib/game.test.ts` (new `describe('winning the game', ...)`, `type GameState` added to the import)
- Modify: `components/PokemonSilhouette.tsx:11-16` (widen the `status` prop type)

**Why `PokemonSilhouette.tsx` is in this task, not Task 5:** its `Props.status` is currently the hand-written literal union `'loading' | 'guessing' | 'revealed'`, not an import of `lib/game.ts`'s `Status` type. The moment `Status` gains `'won'`, `components/Game.tsx`'s existing `<PokemonSilhouette status={state.status} ... />` call (unchanged, still in this task) fails to typecheck — `state.status` is now a wider type than the prop accepts. Fixing it here, in the same task that widens `Status`, keeps `npm run typecheck` green at every commit in this plan rather than leaving it red for one task's duration.

**Interfaces:**
- Consumes: `GameState.usedIds`, `startRound(rng, streak, usedIds)` (Task 3).
- Produces: `Status = 'loading' | 'guessing' | 'revealed' | 'won'`. `components/PokemonSilhouette.tsx`'s `Props.status: Status` (imported from `@/lib/game`, replacing the old literal). Task 5 consumes `'won'` to build the win screen.

- [ ] **Step 1: Write the failing tests**

Append to `lib/game.test.ts`. First, add `type GameState` to the existing import from `./game` (it should already list `isHardDistractor`, `randomPokemonExcluding`, `spellingSimilarity` from Tasks 2–3):

```ts
import {
  createInitialState,
  gameReducer,
  generateOptions,
  isHardDistractor,
  randomPokemon,
  randomPokemonExcluding,
  spellingSimilarity,
  type GameState,
  type Rng,
} from './game'
```

Then add:

```ts
describe('winning the game', () => {
  const allUsedIds = (): ReadonlySet<number> => new Set(pokemonList.map((entry) => entry.id))

  it('reveals the final correct guess normally, without winning yet', () => {
    const lastId = pokemonList[0].id
    const state: GameState = {
      status: 'guessing',
      pokemonId: lastId,
      options: [lastId, pokemonList[1].id, pokemonList[2].id, pokemonList[3].id],
      guess: null,
      streak: 5,
      bestStreak: 5,
      roundId: 5,
      usedIds: allUsedIds(),
    }

    const revealed = gameReducer(state, { type: 'GUESS', pokemonId: lastId })

    expect(revealed.status).toBe('revealed')
    expect(revealed.streak).toBe(6)
  })

  it('transitions to won on the NEXT after the last correct guess, without drawing a new round', () => {
    const lastId = pokemonList[0].id
    const state: GameState = {
      status: 'revealed',
      pokemonId: lastId,
      options: [lastId, pokemonList[1].id, pokemonList[2].id, pokemonList[3].id],
      guess: lastId,
      streak: 6,
      bestStreak: 6,
      roundId: 5,
      usedIds: allUsedIds(),
    }

    const won = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    expect(won.status).toBe('won')
    expect(won.pokemonId).toBe(lastId)
    expect(won.streak).toBe(6)
  })

  it('starts a completely fresh run from the won screen', () => {
    const state: GameState = {
      status: 'won',
      pokemonId: pokemonList[0].id,
      options: pokemonList.slice(0, 4).map((entry) => entry.id),
      guess: pokemonList[0].id,
      streak: pokemonList.length,
      bestStreak: pokemonList.length,
      roundId: 5,
      usedIds: allUsedIds(),
    }

    const restarted = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    expect(restarted.status).toBe('loading')
    expect(restarted.streak).toBe(0)
    expect(restarted.usedIds.size).toBe(1)
    expect(restarted.usedIds.has(restarted.pokemonId)).toBe(true)
    expect(restarted.bestStreak).toBe(pokemonList.length) // untouched by a restart
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/game.test.ts`
Expected: FAIL — `status: 'won'` and `status: 'guessing'`/`'revealed'` objects don't satisfy `GameState`'s current `Status` (TypeScript compile error surfaces as a Vitest failure), and the reducer never produces `'won'`.

- [ ] **Step 3: Write the implementation**

In `lib/game.ts`, widen `Status`:

```ts
export type Status = 'loading' | 'guessing' | 'revealed' | 'won'
```

Replace the `NEXT` case (`GUESS` stays exactly as it is today — untouched):

```ts
case 'NEXT': {
  if (state.status === 'won') {
    // "Start again" from the win screen: a full reset, same as a broken streak.
    const round = startRound(action.rng, 0, new Set())
    return { ...state, ...round, streak: 0, usedIds: new Set([round.pokemonId]), roundId: state.roundId + 1 }
  }
  if (state.streak > 0 && state.usedIds.size === pokemonList.length) {
    // The round just revealed was the last unused entry in the pool.
    return { ...state, status: 'won' }
  }
  const usedIds = state.streak === 0 ? new Set<number>() : state.usedIds
  const round = startRound(action.rng, state.streak, usedIds)
  return { ...state, ...round, usedIds: new Set(usedIds).add(round.pokemonId), roundId: state.roundId + 1 }
}
```

In `components/PokemonSilhouette.tsx`, add the import and widen the prop type:

```ts
import type { Status } from '@/lib/game'
```

```ts
type Props = {
  pokemonId: number
  roundId: number
  status: Status
  onReady: () => void
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/game.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Lint, typecheck, and full test suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all clean (this also confirms `components/Game.test.tsx` still passes untouched at this point — Task 4 doesn't change `Game.tsx` or its tests yet)

- [ ] **Step 6: Commit**

```bash
git add lib/game.ts lib/game.test.ts components/PokemonSilhouette.tsx
git commit -m "$(cat <<'EOF'
Add a won status once a run exhausts the entire Pokémon pool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Win screen UI and keyboard handling

**Files:**
- Modify: `components/Game.tsx` (new `WinScreen` sub-component; `won`/`canAdvance` derived state; keyboard handler; JSX)
- Modify: `components/Game.test.tsx` (fix the two tests whose premise no-repeat breaks)

**Interfaces:**
- Consumes: `state.status === 'won'` (Task 4).
- Produces: no new exports — this is the leaf UI task.

**Why two `components/Game.test.tsx` tests need rewriting, not just re-running:** both tests exploit that `Math.random` is pinned to a constant `0.5` in this file's `beforeEach`, which — before this plan — meant *every* round drawn resolved to the same `pinnedAnswerId`, since `randomPokemon` always computed the same array index from a constant input. Task 3's no-repeat exclusion breaks that assumption for any round that continues a streak: the second round can no longer be `pinnedAnswerId` again, because it's already in `usedIds`. Both tests below were written before Task 3 and become false unless adjusted:
- *"stays playable across NEXT when the same Pokémon is drawn twice in a row"* — this genuinely needs a repeat draw to test the `roundId`-keying fix (see `CLAUDE.md`'s "Why `roundId` exists"). The only way left to force one is across a run boundary: `usedIds` resets to empty right when a run ends, so guessing *wrong* on the very first round, then restarting, draws `pinnedAnswerId` again (rng is still pinned to `0.5`, and the exclusion set is empty again) — two consecutive rounds, same id, exactly the scenario this test exists to guard.
- *"advances to the next round when Space is pressed after a correct guess"* — this one continues a streak (correct guess), so the second round is no longer `pinnedAnswerId`. `randomPokemonExcluding`'s guard-loop-then-fallback is itself deterministic given a constant rng, so the second round's id is computable in the test: the first `pokemonList` entry that isn't `pinnedAnswerId`.

**Note on Steps 1-2 below:** these two tests aren't new coverage for this task's own code — they're regression fixes for an assumption Task 3 already invalidated (see the note above). The underlying behavior they check (no-repeat exclusion, Space advancing) is already live in `lib/game.ts` and in `Game.tsx`'s pre-existing keyboard handling from before this plan. So unlike every other task in this plan, there's no red-green cycle here: once rewritten, both should pass immediately, before Step 3's UI changes even happen. Step 3 (the actual win screen) has no dedicated automated test — per the spec's explicit decision, the reducer tests in Task 4 already cover the state transition, and a full pool-exhaustion isn't practical to script through React Testing Library. Step 6's manual check is what verifies it.

- [ ] **Step 1: Fix the two tests whose premise Task 3 invalidated**

In `components/Game.test.tsx`, replace the *"stays playable across NEXT when the same Pokémon is drawn twice in a row"* test:

```ts
it('stays playable across NEXT when the same Pokémon is drawn twice in a row', async () => {
  // Math.random is pinned to 0.5, so any round drawn with an empty
  // no-repeat exclusion set resolves to pinnedAnswerId (see lib/game.ts's
  // randomPokemonExcluding). A run's exclusion set resets the moment it
  // ends, so guessing wrong on the very first round reproduces two
  // consecutive rounds landing on the same pokemonId — the scenario a real
  // repeat draw would hit: if the round's identity is keyed on `pokemonId`
  // instead of a value that changes every NEXT, the silhouette never
  // remounts, no load event fires, and the round is stuck in 'loading'
  // forever — GUESS is rejected and the guess is silently dropped.
  const user = userEvent.setup()
  render(<Game />)

  const answerName = getPokemonName(pinnedAnswerId)
  const answerButton = screen.getByRole('button', { name: answerName })
  const wrong = screen
    .getAllByRole('button')
    .find((b) => b !== answerButton && b.textContent !== 'Next' && b.textContent !== 'Start again')!
  await user.click(wrong)
  expect(screen.getByTestId('stat-streak')).toHaveTextContent('0')

  await user.click(screen.getByRole('button', { name: 'Start again' }))

  // If the round is stuck in 'loading', the answer button is disabled and
  // this click is silently dropped instead of scoring.
  await user.click(await screen.findByRole('button', { name: answerName }))

  expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
})
```

Replace the *"advances to the next round when Space is pressed after a correct guess"* test:

```ts
it('advances to the next round when Space is pressed after a correct guess', async () => {
  const user = userEvent.setup()
  render(<Game />)

  const answerName = getPokemonName(pinnedAnswerId)
  await user.click(screen.getByRole('button', { name: answerName }))
  expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')

  await user.keyboard(' ')

  // pinnedAnswerId is now excluded for the rest of this run (no-repeat), and
  // Math.random stays pinned to 0.5, so every random draw attempt keeps
  // landing back on the excluded id and falls through to
  // randomPokemonExcluding's deterministic fallback: the first pokemonList
  // entry that isn't excluded.
  const nextAnswerId = pokemonList.find((entry) => entry.id !== pinnedAnswerId)!.id
  await user.click(await screen.findByRole('button', { name: getPokemonName(nextAnswerId) }))
  expect(screen.getByTestId('stat-streak')).toHaveTextContent('2')
})
```

- [ ] **Step 2: Run the component tests to confirm both rewritten tests already pass**

Run: `npx vitest run components/Game.test.tsx`
Expected: PASS (all tests, including the two just rewritten) — Tasks 1-4 are already committed, so `lib/game.ts`'s no-repeat and Space-advance behavior are both already live; this step confirms the rewritten assertions correctly describe that behavior before any `Game.tsx` change happens in Step 3.

- [ ] **Step 3: Write the `components/Game.tsx` implementation**

Add a small presentational component near the top of the file, after `GuessGridPlaceholder`:

```tsx
// Deliberately minimal — a placeholder to replace once the win screen gets
// its own design pass.
const WinScreen = ({ streak }: { streak: number }) => (
  <div className="bg-screen-sunk mb-3 flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center">
    <p className="text-ink text-base font-semibold">You&apos;ve named every Pokémon!</p>
    <p className="text-ink-soft text-sm">Final streak: {streak}</p>
  </div>
)
```

Inside the `Game` component, change the derived-state lines:

```ts
const revealed = mounted && state.status === 'revealed'
const won = mounted && state.status === 'won'
const canAdvance = revealed || won
```

In the keyboard handler, change the `revealed`-only branch to cover `won` too:

```ts
if (state.status === 'revealed' || state.status === 'won') {
  const isNext = state.status === 'revealed' && state.guess === state.pokemonId
  if (event.key === ' ' || (isNext && event.key.toLowerCase() === 'n')) {
    event.preventDefault()
    dispatch({ type: 'NEXT', rng })
  }
}
```

In the JSX, wrap the silhouette + revealed-name label + guess grid trio in a `won` conditional:

```tsx
{won ? (
  <WinScreen streak={state.streak} />
) : (
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
)}
```

Finally, update the advance button — `disabled`, the Space-bar hint's visibility condition, and the label all switch from `revealed` to `canAdvance` (the label keeps its existing wrong-guess check, just adds `won`):

```tsx
<button
  type="button"
  onClick={() => dispatch({ type: 'NEXT', rng })}
  disabled={!canAdvance}
  className="bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark mt-4 flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99] disabled:cursor-default disabled:opacity-40"
>
  {canAdvance && (
    <span
      aria-hidden="true"
      className="text-button/40 hidden size-5 shrink-0 items-center justify-center rounded border border-current/40 text-xs font-semibold sm:flex"
    >
      _
    </span>
  )}
  {won || (revealed && state.guess !== state.pokemonId) ? 'Start again' : 'Next'}
</button>
```

- [ ] **Step 4: Run the full test suite to verify everything passes**

Run: `npm test`
Expected: PASS (all files, including `components/Game.test.tsx`'s two rewritten tests)

- [ ] **Step 5: Lint, typecheck, and build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: all clean

- [ ] **Step 6: Manually verify the win screen in the browser**

This can't be reached through normal play in any reasonable time (the pool is ~1200 entries), so verify by temporarily hacking the reducer's win condition down to a tiny number, loading `npm run dev`, playing to that number, confirming the win screen renders (message, "Start again" enabled, Space restarts, previous silhouette/grid gone), then **reverting the temporary hack** before moving on — do not commit it.

- [ ] **Step 7: Commit**

```bash
git add components/Game.tsx components/Game.test.tsx
git commit -m "$(cat <<'EOF'
Add the win screen and extend Space/N handling to cover it

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Documentation

**Files:**
- Modify: `CLAUDE.md:52` (insert a new paragraph after the `lib/pokemon.ts` paragraph), `CLAUDE.md:72-77` (insert a new subsection after "Why `roundId` exists")

**Interfaces:** none — this task only documents what Tasks 1–5 already built.

- [ ] **Step 1: Add the `lib/gameConfig.ts` paragraph**

In `CLAUDE.md`, immediately after the paragraph ending "...since ids are no longer contiguous once forms are included." (the `lib/pokemon.ts` paragraph, currently ending at line 52), insert:

```markdown

**`lib/gameConfig.ts`** holds the tunable difficulty numbers — `DIFFICULTY_CURVE`
(how many "hard" distractors appear per streak band), `DEX_PROXIMITY` and
`SIMILARITY_THRESHOLD` (what counts as a "hard" distractor). Retuning
difficulty is an edit to this file, not to `lib/game.ts`'s logic.
```

- [ ] **Step 2: Add the no-repeat/winning subsection**

Immediately after the "### Why `roundId` exists" section (currently ending "...Key and re-run effects on `roundId`, never on `pokemonId`." at line 77), insert a new subsection before "### Hiding the answer":

```markdown

### No-repeat draws and winning

`GameState.usedIds` tracks every Pokémon drawn as the answer during the
current unbroken streak ("run"); the next draw excludes it
(`randomPokemonExcluding`), so the same Pokémon never repeats within a run.
It resets the moment a run ends (a wrong guess). If a run's `usedIds` ever
grows to cover the entire `pokemonList`, that's a win: `Status` gains
`'won'`, set on the `NEXT` after the last correct guess (not on the `GUESS`
itself, so the final reveal is still shown first) — no new round is drawn at
that point, so `roundId` is untouched by it.
```

- [ ] **Step 3: Proofread**

Read the full `## Architecture` section top to bottom and confirm the new paragraph and subsection read naturally in place, don't duplicate anything already said, and match the surrounding prose style (no semicolons in prose is not a real constraint — that's code-only — just match tone).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
Document lib/gameConfig.ts and the no-repeat/winning behavior

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
