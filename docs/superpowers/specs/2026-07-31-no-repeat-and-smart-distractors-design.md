# No-repeat answers within a run, and difficulty-scaled distractors

## Why

Two related gaps in the current round-generation logic (`lib/game.ts`):

1. `randomPokemon` draws independently every round, so the same Pokémon can
   be the answer twice in a row (or repeatedly) within one streak — no memory
   of what's already been shown.
2. `generateOptions` fills the three wrong options by pure random draw, so
   every round is the same difficulty regardless of how good the player
   already is at the game — an option is never particularly related to the
   answer.

This spec covers both, plus centralizing the new tunable numbers (the
difficulty ramp, the "same family" and "similar spelling" thresholds) in one
place so they're easy to retune later without touching logic.

## Scope

In scope: not repeating the answer within an unbroken streak; making some
wrong options harder to rule out as the streak grows; a config module for the
new tunables; a win condition when a run exhausts the entire pool.

Out of scope (explicitly, re-evaluate if this changes): fetching real
evolution-chain data from PokeAPI (the "same family" check stays a
`speciesDex`-proximity heuristic, not authoritative evolution data); excluding
previously-seen Pokémon from ever appearing as a *wrong* option (only the
answer is guaranteed fresh); persisting `usedIds` across a page reload (it's
in-memory reducer state, same lifetime as `streak`); designing the
congratulations screen's visuals — this spec covers the mechanics and a
minimal placeholder message, not the final presentation.

## No-repeat within a run

"A run" = the current unbroken streak, matching the game's existing streak
concept — the moment a guess is wrong (`streak` resets to `0`), the next round
is free to draw anything again, including Pokémon just shown.

`GameState` gains one field:

```ts
usedIds: ReadonlySet<number> // answers drawn so far in the current unbroken streak
```

A new helper draws a random entry while excluding a set of ids, following the
same guard-loop-then-deterministic-fallback shape `generateOptions` already
uses for its own edge cases:

```ts
export const randomPokemonExcluding = (rng: Rng, excludeIds: ReadonlySet<number>): PokemonEntry => {
  let guard = 0
  let candidate = randomPokemon(rng)
  while (excludeIds.has(candidate.id) && guard < 1000) {
    candidate = randomPokemon(rng)
    guard += 1
  }
  if (!excludeIds.has(candidate.id)) return candidate
  // Guard tripped: an enormous run has nearly exhausted the ~1300-entry pool
  // (or a pathological rng). Deterministically wrap to the first still-unused
  // entry so the run keeps going instead of stalling; if literally every
  // entry has been used, the run has cycled the whole pool, so reuse the
  // guard loop's last draw rather than getting stuck.
  return pokemonList.find((entry) => !excludeIds.has(entry.id)) ?? candidate
}
```

`startRound` takes `streak` and `usedIds` and threads them through:

```ts
const startRound = (
  rng: Rng,
  streak: number,
  usedIds: ReadonlySet<number>,
): Pick<GameState, 'status' | 'pokemonId' | 'options' | 'guess'> => {
  const pokemonId = randomPokemonExcluding(rng, usedIds).id
  return { status: 'loading', pokemonId, options: generateOptions(pokemonId, streak, rng), guess: null }
}
```

`createInitialState` seeds `usedIds` with the first round's own draw. The
`NEXT` reducer case resets `usedIds` to empty exactly when the streak that
just ended was broken (`state.streak === 0` — `GUESS` already zeroed it before
`NEXT` is ever dispatched, so this check alone distinguishes "run continues"
from "run just ended"), then adds the new round's draw. The full `NEXT` case
— including what happens when the pool runs out — is in "Winning the game"
below.

Repeats are blocked by exact `id`, not species — a base form and its Mega/
regional/Gigantamax forms are distinct ids and can each independently be the
answer within the same run.

## Winning the game

If a run's `usedIds` ever grows to cover the entire pool, there's nothing
left to draw — the player has correctly named every entry in `pokemonList`
without a single wrong guess in between. That's a win, not an edge case to
paper over.

`Status` gains a fourth value: `'loading' | 'guessing' | 'revealed' | 'won'`.

`GUESS` is unchanged — the final correct guess reveals exactly like any other
(checkmark, name, streak increment). The transition to `'won'` happens on the
*next* `NEXT`, so the player always sees that last reveal before the screen
changes:

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

This makes the wrap-around fallback inside `randomPokemonExcluding` (see
above) unreachable in normal play — the pool is never actually asked to yield
a draw once it's exhausted, because the second branch here catches that
exact moment first. The fallback stays in as defensive code, not as the
mechanism this relies on.

`components/Game.tsx` gets a `state.status === 'won'` branch that replaces
the silhouette and guess grid with a plain message block — final streak,
minimal copy for now, easy to reskin later. The advance button's
enabled/label logic (currently `revealed = mounted && state.status ===
'revealed'`, disabled when `!revealed`, labelled "Start again" when the
guess was wrong) extends to treat `'won'` the same way as a wrong-guess
reveal: enabled, labelled "Start again". The existing Space/N keyboard
handler extends the same way — Space advances for both `'revealed'` and
`'won'`; `N` stays scoped to "Next" specifically (`status === 'revealed' &&
guess === pokemonId`), so it does nothing on the win screen.

## Difficulty-scaled distractors

`generateOptions` gains a `streak` parameter. Before falling back to today's
pure-random fill, it tries to seed a target number of "hard" distractors —
wrong options that are plausible enough to make the guess harder:

```ts
export const generateOptions = (answerId: number, streak: number, rng: Rng): number[] => {
  const answer = getPokemonEntry(answerId)
  const hardTarget = hardDistractorCountForStreak(streak)
  const options = new Set<number>([answerId])

  const hardCandidates = shuffle(
    pokemonList.filter((entry) => entry.id !== answerId && isHardDistractor(answer, entry)),
    rng,
  )
  for (const candidate of hardCandidates) {
    if (options.size >= 1 + hardTarget) break
    options.add(candidate.id)
  }

  // Unchanged from today: random fill, then deterministic fallback fill,
  // guaranteeing exactly 4 unique ids regardless of how the hard-candidate
  // phase went.
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

At `streak` 0 (every fresh game, and the first round of every run),
`hardTarget` is 0, so this is byte-for-byte the same random-fill behavior as
today — the existing tests that never drive the streak up stay valid
unchanged.

`isHardDistractor` combines two independent signals — either is enough:

```ts
const isHardDistractor = (answer: PokemonEntry, candidate: PokemonEntry): boolean =>
  Math.abs(answer.speciesDex - candidate.speciesDex) <= DEX_PROXIMITY ||
  spellingSimilarity(answer.name, candidate.name) >= SIMILARITY_THRESHOLD
```

- **Dex proximity** catches most same-evolution-family pairs (three-stage
  lines are usually three consecutive dex numbers) without needing real
  evolution-chain data. Known miss: branching lines like Eevee's evolutions
  aren't dex-adjacent to each other, so they won't be flagged as "hard" by
  this signal. Accepted limitation per the decision to avoid fetching
  evolution-chain data for this.
- **Spelling similarity** is normalized Levenshtein distance (accents,
  punctuation and spaces stripped, lowercased, distance divided by the longer
  name's length, inverted to a 0–1 similarity score), catching pairs the dex
  check misses — e.g. Nidoran♂/Nidoran♀ (dex 32/29, not proximate, but
  identical once normalized), or coincidentally similar names like Doduo/
  Dodrio.

```ts
const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (Flabébé -> flabebe)
    .replace(/[^a-z0-9]/gi, '') // strip spaces, punctuation, gender symbols
    .toLowerCase()

const spellingSimilarity = (nameA: string, nameB: string): number => {
  const a = normalizeName(nameA)
  const b = normalizeName(nameB)
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 0 : 1 - levenshteinDistance(a, b) / maxLen
}
```

`levenshteinDistance` is the standard O(nm) dynamic-programming edit
distance. Against the ~1300-entry list with names under ~20 characters, a
full pass is on the order of a few hundred thousand primitive operations —
comfortably sub-millisecond, which is why this runs synchronously inline
(see Architecture below) rather than needing to be precomputed ahead of time.

If fewer hard candidates exist than `hardTarget` (possible for isolated dex
entries with no similarly-spelled name anywhere in the list), the existing
random-fill phase makes up the difference — `generateOptions` never fails to
return 4 options.

## Centralized config

New file, `lib/gameConfig.ts` — the one place difficulty numbers live:

```ts
// Ordered ascending by minStreak; the first band's minStreak must be 0.
// hardDistractorCountForStreak picks the highest band the streak has reached.
export const DIFFICULTY_CURVE: readonly { minStreak: number; hardDistractors: number }[] = [
  { minStreak: 0, hardDistractors: 0 },
  { minStreak: 3, hardDistractors: 1 },
  { minStreak: 8, hardDistractors: 2 },
  { minStreak: 15, hardDistractors: 3 },
]

export const DEX_PROXIMITY = 2 // |speciesDex_a - speciesDex_b| <= this counts as "same family"
export const SIMILARITY_THRESHOLD = 0.5 // normalized name-similarity score (0-1) to count as "similar spelling"

export const hardDistractorCountForStreak = (streak: number): number => {
  let count = DIFFICULTY_CURVE[0].hardDistractors
  for (const band of DIFFICULTY_CURVE) {
    if (streak < band.minStreak) break
    count = band.hardDistractors
  }
  return count
}
```

`lib/game.ts` imports `hardDistractorCountForStreak`, `DEX_PROXIMITY` and
`SIMILARITY_THRESHOLD` from here and never hardcodes them itself. Retuning
the ramp later — later plateau, an extra band, a looser similarity score — is
an edit to this one file, no logic changes.

## Architecture

Both mechanisms stay inside `lib/game.ts`'s existing pure, synchronous model:
`rng` passed in, no `Math.random`, no async. As covered when this came up
earlier: the corpus (~1300 entries) and the heuristics involved (integer
comparison, Levenshtein against short strings) are cheap enough that
computing a round's options inline, synchronously, costs a fraction of a
millisecond — there's no case here where precomputing the next round during
the reveal phase would pay for its own complexity, and doing so would mean
async state living outside the reducer, reintroducing the kind of
hydration-timing risk the codebase's `useMounted` gate exists specifically to
avoid (see CLAUDE.md's hydration-constraint section).

## Testing

- `lib/gameConfig.test.ts` (new): `hardDistractorCountForStreak` at each band
  boundary (0, 2, 3, 7, 8, 14, 15, and a large streak).
- `lib/game.test.ts` (extended): `generateOptions` at `streak = 0` still
  behaves exactly as the current random-fill tests expect (regression
  safety); at a streak within each band, returned options include the
  expected count of entries satisfying `isHardDistractor` against the
  answer, using scripted rng; `spellingSimilarity` directly, on a couple of
  known pairs (e.g. Doduo/Dodrio scoring high, Bulbasaur/Charmander scoring
  low); `randomPokemonExcluding` respects its exclusion set and its
  fallback path. `isHardDistractor` and `spellingSimilarity` become named
  exports from `lib/game.ts` for this.
- `lib/game.test.ts` (extended): the reducer accumulates `usedIds` across
  consecutive correct-guess `NEXT`s and resets it after a wrong-guess `NEXT`,
  with a scripted rng verifying the excluded id is never redrawn.
- `lib/game.test.ts` (extended): a scripted state with `usedIds` one short of
  `pokemonList.length` and `streak > 0` — a correct `GUESS` still reveals
  normally (`status: 'revealed'`, unchanged from any other correct guess);
  the following `NEXT` transitions to `status: 'won'` without drawing a new
  round; a further `NEXT` from `'won'` resets `streak` to 0, `usedIds` to a
  fresh single-entry set, and draws normally again.
- `components/Game.test.tsx`: unchanged. It never drives the streak past a
  correct guess or two, so it stays within the `streak = 0`/early-band
  behavior and needs no updates. (A dedicated win-screen UI test isn't worth
  scripting a full pool exhaustion through React Testing Library — the
  reducer tests above already cover the transition; once the screen's actual
  design lands, that's the natural point to add a UI test for it.)

## Docs

CLAUDE.md's architecture section gets a short addition describing
`lib/gameConfig.ts`'s role and pointing at it as where to retune difficulty,
alongside the existing `lib/game.ts` description, plus a one-line mention of
the `'won'` status and what triggers it, next to the existing "Why `roundId`
exists" explanation (roundId is untouched by the win transition itself, since
no new round is drawn at that moment — worth stating explicitly so it doesn't
look like an oversight).
