# PokeAPI Sprite Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Pokéguess's sprite source and Pokémon list with data generated from PokeAPI, extending coverage to the full national dex (1–1025) and adding Mega Evolutions, regional forms (Alolan/Galarian/Hisuian/Paldean), and Gigantamax forms as guessable entries.

**Architecture:** A one-off/re-runnable Node script (`scripts/build-pokemon-data.mjs`) fetches two bulk PokeAPI endpoints, filters and resolves the in-scope forms, and writes a generated data file (`lib/pokemonData.ts`). Game logic and components move from treating "dex number" as the unique identifier to treating a `PokemonEntry.id` (which doubles as the `official-artwork` filename) as the identifier, with `speciesDex` as a separate display-only field two entries can share.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Vitest, no new dependencies (Node 22's built-in `fetch`).

## Global Constraints

- No semicolons, single quotes, 2-space indent (`.oxlintrc.json` / existing style — match the surrounding file).
- `@/*` path alias maps to the repo root.
- `lib/` stays pure — no `Math.random` inside it; the `Rng` parameter continues to be threaded through explicitly.
- Interactive Tailwind states stay gated behind `enabled:` (not touched by this plan, but don't regress it while editing `GuessButton.tsx`/`Game.tsx`).
- Run `npm run lint`, `npm run typecheck`, and `npm test` before considering any task done; run `npm run build` at the end of the plan since it's the only check that exercises static generation.
- The data-generation script is a manual/dev-time tool, not part of `build` or CI — it hits the network.

---

## Task 1: Seed the species display-name list

**Why this is its own task:** the generation script (Task 2) needs a correctly-formatted display name for every one of the 1025 base species before it can build form names like "Mega Venusaur" or "Alolan Raichu". `lib/pokemon.ts` already has 905 of these, hand-verified (handles `Nidoran♀`, `Mr. Mime`, `Farfetch'd`, `Porygon-Z`, etc.) — reuse them verbatim rather than re-deriving from PokeAPI's lowercase-kebab slugs, which would mangle all of that. Only the 120 species added since (dex 906–1025, Generation 9) need to be supplied fresh.

**Files:**
- Create: `scripts/species-names.json`
- Read (do not modify yet): `lib/pokemon.ts:1-907`

**Interfaces:**
- Produces: a JSON file containing a single array of exactly 1025 strings, index `n` holding the name for dex `n + 1`. Task 2 reads this file.

- [ ] **Step 1: Copy the existing 905 names verbatim**

Open `lib/pokemon.ts` and copy lines 2–906 (the string literals between the `pokemonNames` array's opening `[` on line 1 and closing `]` on line 907) — do not retype them by hand, copy exactly as written so no accents/symbols/apostrophes are lost.

- [ ] **Step 2: Append the 120 Generation 9 names**

Append these 120 names, in order, immediately after the copied 905 (so the final array has exactly 1025 entries, index 905 = dex 906 = "Sprigatito"):

```json
"Sprigatito", "Floragato", "Meowscarada", "Fuecoco", "Crocalor", "Skeledirge",
"Quaxly", "Quaxwell", "Quaquaval", "Lechonk", "Oinkologne", "Tarountula",
"Spidops", "Nymble", "Lokix", "Pawmi", "Pawmo", "Pawmot", "Tandemaus",
"Maushold", "Fidough", "Dachsbun", "Smoliv", "Dolliv", "Arboliva",
"Squawkabilly", "Nacli", "Naclstack", "Garganacl", "Charcadet", "Armarouge",
"Ceruledge", "Tadbulb", "Bellibolt", "Wattrel", "Kilowattrel", "Maschiff",
"Mabosstiff", "Shroodle", "Grafaiai", "Bramblin", "Brambleghast", "Toedscool",
"Toedscruel", "Klawf", "Capsakid", "Scovillain", "Rellor", "Rabsca",
"Flittle", "Espathra", "Tinkatink", "Tinkatuff", "Tinkaton", "Wiglett",
"Wugtrio", "Bombirdier", "Finizen", "Palafin", "Varoom", "Revavroom",
"Cyclizar", "Orthworm", "Glimmet", "Glimmora", "Greavard", "Houndstone",
"Flamigo", "Cetoddle", "Cetitan", "Veluza", "Dondozo", "Tatsugiri",
"Annihilape", "Clodsire", "Farigiraf", "Dudunsparce", "Kingambit",
"Great Tusk", "Scream Tail", "Brute Bonnet", "Flutter Mane", "Slither Wing",
"Sandy Shocks", "Iron Treads", "Iron Bundle", "Iron Hands", "Iron Jugulis",
"Iron Moth", "Iron Thorns", "Frigibax", "Arctibax", "Baxcalibur",
"Gimmighoul", "Gholdengo", "Wo-Chien", "Chien-Pao", "Ting-Lu", "Chi-Yu",
"Roaring Moon", "Iron Valiant", "Koraidon", "Miraidon", "Walking Wake",
"Iron Leaves", "Dipplin", "Poltchageist", "Sinistcha", "Okidogi",
"Munkidori", "Fezandipiti", "Ogerpon", "Archaludon", "Hydrapple",
"Gouging Fire", "Raging Bolt", "Iron Boulder", "Iron Crown", "Terapagos",
"Pecharunt"
```

Format the whole thing as a single JSON array (`["Bulbasaur", "Ivysaur", ..., "Pecharunt"]`) in `scripts/species-names.json`.

- [ ] **Step 3: Verify the count and a few positions**

Run:

```bash
node -e "
const names = require('./scripts/species-names.json')
console.assert(names.length === 1025, 'expected 1025 names, got ' + names.length)
console.assert(names[0] === 'Bulbasaur', 'index 0 should be Bulbasaur, got ' + names[0])
console.assert(names[905] === 'Sprigatito', 'index 905 should be Sprigatito, got ' + names[905])
console.assert(names[1024] === 'Pecharunt', 'index 1024 should be Pecharunt, got ' + names[1024])
console.log('OK:', names.length, 'names')
"
```

Expected output: `OK: 1025 names` with no assertion failures.

- [ ] **Step 4: Commit**

```bash
git add scripts/species-names.json
git commit -m "Add the full national-dex species name list (through Gen 9)"
```

---

## Task 2: Write and run the PokeAPI data-generation script

**Files:**
- Create: `scripts/build-pokemon-data.mjs`
- Create (generated output): `lib/pokemonData.ts`
- Modify: `package.json` (add `pokemon:build` script)

**Interfaces:**
- Consumes: `scripts/species-names.json` (array of 1025 strings, from Task 1)
- Produces: `lib/pokemonData.ts` exporting:
  ```ts
  export type PokemonEntry = {
    id: number
    name: string
    speciesDex: number
  }
  export const pokemonList: readonly PokemonEntry[]
  ```
  Task 3 (`lib/pokemon.ts` helpers) and Task 4 (`lib/game.ts`) both import from here.

This task has no unit test of its own — it's a network script whose output is verified by inspection (Step 3) rather than assertions, since its correctness depends on live PokeAPI data. Treat "the two request/response shapes below" and "the spot-checks in Step 3" as the acceptance criteria.

- [ ] **Step 1: Write the script**

Create `scripts/build-pokemon-data.mjs`:

```js
import { writeFileSync, readFileSync } from 'node:fs'

const SPECIES_NAMES = JSON.parse(readFileSync(new URL('./species-names.json', import.meta.url)))

// Markers that mean "this is a battle-only or cosmetic variant riding on an
// in-scope suffix, not the regional form / mega / gigantamax itself" — e.g.
// raticate-totem-alola, darmanitan-galar-zen, pikachu-alola-cap.
const EXCLUDE_MARKERS = ['totem', 'zen', 'cap', 'starter']

// A handful of Gigantamax species whose PokeAPI name carries an extra
// cosmetic-form segment before "-gmax" that doesn't match the species name
// directly (Toxtricity and Urshifu each have two named styles). This is a
// closed, known set, not a heuristic — extend it only if a future game adds
// another species shaped like this.
const COSMETIC_GMAX_EXCEPTIONS = {
  'toxtricity-amped': 'toxtricity',
  'toxtricity-low-key': 'toxtricity',
  'urshifu-single-strike': 'urshifu',
  'urshifu-rapid-strike': 'urshifu',
}

const SUFFIXES = [
  ['-mega-x', 'mega-x'],
  ['-mega-y', 'mega-y'],
  ['-mega', 'mega'],
  ['-gmax', 'gmax'],
  ['-alola', 'alola'],
  ['-galar', 'galar'],
  ['-hisui', 'hisui'],
]

const PALDEA_BREED_RE = /^(.+)-paldea-(\w+)-breed$/

const displayName = (speciesName, kind, extra) => {
  switch (kind) {
    case 'mega': return `Mega ${speciesName}`
    case 'mega-x': return `Mega ${speciesName} X`
    case 'mega-y': return `Mega ${speciesName} Y`
    case 'gmax': return `Gigantamax ${speciesName}`
    case 'alola': return `Alolan ${speciesName}`
    case 'galar': return `Galarian ${speciesName}`
    case 'hisui': return `Hisuian ${speciesName}`
    case 'paldea': return `Paldean ${speciesName}`
    case 'paldea-breed': return `Paldean ${speciesName} (${extra[0].toUpperCase()}${extra.slice(1)} Breed)`
    default: throw new Error(`unhandled kind: ${kind}`)
  }
}

const idFromUrl = (url) => Number(url.split('/').filter(Boolean).pop())

const fetchAll = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const body = await res.json()
  if (body.next !== null) throw new Error(`${url} is paginated (next: ${body.next}); raise the limit`)
  if (body.results.length !== body.count) {
    throw new Error(`${url}: expected ${body.count} results, got ${body.results.length}`)
  }
  return body.results
}

console.log('Fetching species list...')
const speciesResults = await fetchAll('https://pokeapi.co/api/v2/pokemon-species?limit=2000')
const speciesDexByName = new Map(speciesResults.map((s) => [s.name, idFromUrl(s.url)]))

console.log('Fetching pokemon list...')
const pokemonResults = await fetchAll('https://pokeapi.co/api/v2/pokemon?limit=2000')

if (speciesDexByName.size !== SPECIES_NAMES.length) {
  throw new Error(
    `PokeAPI has ${speciesDexByName.size} species but species-names.json has ${SPECIES_NAMES.length}; ` +
      'update Task 1 before regenerating.',
  )
}

const speciesDisplayName = (dex) => {
  const name = SPECIES_NAMES[dex - 1]
  if (!name) throw new Error(`no display name for dex ${dex} in species-names.json`)
  return name
}

const entries = []
for (const [name, dex] of speciesDexByName) {
  entries.push({ id: dex, name: speciesDisplayName(dex), speciesDex: dex })
}

const dropped = []
for (const p of pokemonResults) {
  const raw = p.name
  if (EXCLUDE_MARKERS.some((marker) => raw.includes(marker))) continue
  const normalized = raw.replace(/-standard$/, '')

  const breedMatch = normalized.match(PALDEA_BREED_RE)
  if (breedMatch) {
    const [, base, flavor] = breedMatch
    const dex = speciesDexByName.get(base)
    if (dex) {
      entries.push({
        id: idFromUrl(p.url),
        name: displayName(speciesDisplayName(dex), 'paldea-breed', flavor),
        speciesDex: dex,
      })
    } else {
      dropped.push(raw)
    }
    continue
  }

  if (normalized.endsWith('-paldea')) {
    const base = normalized.slice(0, -'-paldea'.length)
    const dex = speciesDexByName.get(base)
    if (dex) {
      entries.push({ id: idFromUrl(p.url), name: displayName(speciesDisplayName(dex), 'paldea'), speciesDex: dex })
    } else {
      dropped.push(raw)
    }
    continue
  }

  const suffixMatch = SUFFIXES.find(([suffix]) => normalized.endsWith(suffix))
  if (!suffixMatch) continue
  const [suffix, kind] = suffixMatch
  const stripped = normalized.slice(0, -suffix.length)
  const base = speciesDexByName.has(stripped) ? stripped : COSMETIC_GMAX_EXCEPTIONS[stripped]
  if (!base) {
    dropped.push(raw)
    continue
  }
  const dex = speciesDexByName.get(base)
  entries.push({ id: idFromUrl(p.url), name: displayName(speciesDisplayName(dex), kind), speciesDex: dex })
}

entries.sort((a, b) => a.id - b.id)

console.log(`Base species: ${speciesDexByName.size}`)
console.log(`Forms included: ${entries.length - speciesDexByName.size}`)
console.log(`Total entries: ${entries.length}`)
console.log(`Dropped (no species match — review before trusting): ${JSON.stringify(dropped)}`)

const banner = `// GENERATED FILE — do not hand-edit.
// Regenerate with \`npm run pokemon:build\` (scripts/build-pokemon-data.mjs).
`
const body =
  banner +
  '\nexport type PokemonEntry = {\n  id: number\n  name: string\n  speciesDex: number\n}\n\n' +
  'export const pokemonList: readonly PokemonEntry[] = ' +
  JSON.stringify(entries, null, 2) +
  '\n'

writeFileSync(new URL('../lib/pokemonData.ts', import.meta.url), body)
console.log('Wrote lib/pokemonData.ts')
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` (keep existing entries, insert alphabetically or next to `"lint"` — match the file's existing ordering style):

```json
"pokemon:build": "node scripts/build-pokemon-data.mjs",
```

- [ ] **Step 3: Run it and verify the output**

```bash
npm run pokemon:build
```

The console summary should print `Dropped (no species match — review before trusting):` followed by a **short** list — at the time this plan was written, the only PokeAPI entries with no clean species resolution were `meowstic-male-mega`, `meowstic-female-mega`, `magearna-original-mega`, `tatsugiri-curly-mega`, `tatsugiri-droopy-mega`, `tatsugiri-stretchy-mega` (verified against Bulbapedia's Mega Evolution list — these six are not official Mega Evolutions, unlike the other ~85 `-mega`/`-mega-x`/`-mega-y` matches, which include a large batch newly added by *Pokémon Legends: Z-A*). If the dropped list contains anything that looks like it *should* be in scope, or is missing something you'd expect, stop and investigate the filtering logic above before proceeding — don't hand-edit `lib/pokemonData.ts` to patch around it, fix the script and regenerate.

Then spot-check the generated file directly with `grep` (plain `node` can't run a `.ts` file, so this is just text inspection rather than importing it):

```bash
grep -c '"id":' lib/pokemonData.ts
grep -A2 '"id": 1,' lib/pokemonData.ts | head -4
grep -B1 -A2 '"name": "Mega Venusaur"' lib/pokemonData.ts
grep -B1 -A2 '"name": "Alolan Raichu"' lib/pokemonData.ts
grep -B1 -A2 '"name": "Galarian Darmanitan"' lib/pokemonData.ts
grep -B1 -A2 '"name": "Gigantamax Toxtricity"' lib/pokemonData.ts
```

Expected: the id count is in the low 1200s; id 1 has `"name": "Bulbasaur"` and `"speciesDex": 1`; Mega Venusaur has `"speciesDex": 3`; Alolan Raichu has `"speciesDex": 26`; Galarian Darmanitan and Gigantamax Toxtricity are both present (these two specifically exercise the `-standard` stripping and the cosmetic-gmax-exceptions map — if either is missing, one of those two code paths is broken).

- [ ] **Step 4: Commit**

```bash
git add scripts/build-pokemon-data.mjs lib/pokemonData.ts package.json
git commit -m "Generate the full Pokémon list (base species + megas/regional forms/gigantamax) from PokeAPI"
```

---

## Task 3: Rewrite `lib/pokemon.ts` as a lookup helper over the generated data

**Files:**
- Modify: `lib/pokemon.ts` (full rewrite)
- Delete: `lib/formatDexNumber.ts`
- Create: `lib/pokemon.test.ts`

**Interfaces:**
- Consumes: `PokemonEntry`, `pokemonList` from `lib/pokemonData.ts` (Task 2)
- Produces:
  ```ts
  export const getPokemonEntry: (id: number) => PokemonEntry
  export const getPokemonName: (id: number) => string
  export const getSpeciesDex: (id: number) => number
  ```
  Task 4 (`lib/game.ts`), Task 5 (components), and their tests all import these by name.

`formatDexNumber.ts` is deleted here rather than in Task 5: once the sprite filename is `${id}.png` (unpadded), nothing calls it, and it's cleanest to remove it in the same task that removes its only test coverage.

- [ ] **Step 1: Write the failing test**

Create `lib/pokemon.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { getPokemonEntry, getPokemonName, getSpeciesDex } from './pokemon'

describe('getPokemonEntry', () => {
  it('resolves a base species by id', () => {
    expect(getPokemonEntry(1)).toEqual({ id: 1, name: 'Bulbasaur', speciesDex: 1 })
  })

  it('resolves a form to its own id but the base species dex', () => {
    const entry = getPokemonEntry(10033) // Mega Venusaur
    expect(entry.name).toBe('Mega Venusaur')
    expect(entry.speciesDex).toBe(3)
    expect(entry.id).toBe(10033)
  })

  it('falls back to a placeholder for an unknown id', () => {
    expect(getPokemonEntry(999999)).toEqual({ id: 999999, name: 'Unknown', speciesDex: 999999 })
  })
})

describe('getPokemonName', () => {
  it('returns the entry name', () => {
    expect(getPokemonName(1)).toBe('Bulbasaur')
  })
})

describe('getSpeciesDex', () => {
  it('returns the entry species dex', () => {
    expect(getSpeciesDex(10033)).toBe(3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/pokemon.test.ts`
Expected: FAIL — `lib/pokemon.ts` still exports the old `pokemonNames`/`getPokemonName(dex)` shape, not `getPokemonEntry`/`getSpeciesDex`.

- [ ] **Step 3: Rewrite `lib/pokemon.ts`**

Replace the entire file with:

```ts
import { pokemonList, type PokemonEntry } from './pokemonData'

const entryById = new Map<number, PokemonEntry>(pokemonList.map((entry) => [entry.id, entry]))

export const getPokemonEntry = (id: number): PokemonEntry =>
  entryById.get(id) ?? { id, name: 'Unknown', speciesDex: id }

export const getPokemonName = (id: number): string => getPokemonEntry(id).name

export const getSpeciesDex = (id: number): number => getPokemonEntry(id).speciesDex
```

- [ ] **Step 4: Delete `formatDexNumber.ts`**

```bash
rm lib/formatDexNumber.ts
```

(Its only test coverage currently lives inside `lib/game.test.ts`, lines 19–26 — Task 4 removes that block when it rewrites the file, so don't worry about a dangling test yet.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- lib/pokemon.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/pokemon.ts lib/pokemon.test.ts
git rm lib/formatDexNumber.ts
git commit -m "Rework lib/pokemon.ts into an id-keyed lookup over the generated list"
```

---

## Task 4: Rework `lib/game.ts` for id-based selection

**Files:**
- Modify: `lib/game.ts` (full rewrite)
- Modify: `lib/game.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `pokemonList`, `PokemonEntry` from `lib/pokemonData.ts` (Task 2)
- Produces:
  ```ts
  export type Rng = () => number
  export const randomPokemon: (rng: Rng) => PokemonEntry
  export const generateOptions: (answerId: number, rng: Rng) => number[]
  export type GameState = {
    status: Status
    pokemonId: number
    options: number[]
    guess: number | null
    streak: number
    bestStreak: number | null
    roundId: number
  }
  export type GameAction =
    | { type: 'IMAGE_READY' }
    | { type: 'GUESS'; pokemonId: number }
    | { type: 'NEXT'; rng: Rng }
    | { type: 'HYDRATE_BEST'; bestStreak: number }
  export const createInitialState: (rng: Rng) => GameState
  export const gameReducer: (state: GameState, action: GameAction) => GameState
  ```
  Task 5 (`components/Game.tsx`, `GuessGrid.tsx`, `GuessButton.tsx`, `PokemonSilhouette.tsx`) consumes `GameState.pokemonId`, dispatches `{ type: 'GUESS', pokemonId }`, and imports nothing else new from this file.

- [ ] **Step 1: Rewrite the test file first**

Replace `lib/game.test.ts` entirely with:

```ts
import { describe, expect, it } from 'vitest'

import { pokemonList } from './pokemonData'
import { createInitialState, gameReducer, generateOptions, randomPokemon, type Rng } from './game'

const makeRng = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

const validIds = new Set(pokemonList.map((entry) => entry.id))

describe('randomPokemon', () => {
  it('maps 0 to the first entry and just under 1 to the last entry', () => {
    expect(randomPokemon(() => 0)).toBe(pokemonList[0])
    expect(randomPokemon(() => 0.999999)).toBe(pokemonList[pokemonList.length - 1])
  })
})

describe('generateOptions', () => {
  it('always includes the answer', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const options = generateOptions(42, makeRng([seed / 50]))
      expect(options).toContain(42)
    }
  })

  it('returns exactly four options', () => {
    expect(generateOptions(42, makeRng([0.1, 0.2, 0.3]))).toHaveLength(4)
  })

  it('never returns duplicates', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const options = generateOptions(42, makeRng([seed / 50]))
      expect(new Set(options).size).toBe(4)
    }
  })

  it('only returns ids that exist in pokemonList', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const option of generateOptions(42, makeRng([seed / 50]))) {
        expect(validIds.has(option)).toBe(true)
      }
    }
  })

  it('makes progress even when the rng keeps returning the answer', () => {
    const answerDraw = 41 / pokemonList.length // resolves to pokemonList[41], id 42
    expect(generateOptions(42, makeRng([answerDraw, 0.5, 0.6, 0.7]))).toHaveLength(4)
  })
})

describe('gameReducer', () => {
  // Math.random is pinned to 0.5 in components/Game.test.tsx, so this mirrors
  // that selection to know which id every round resolves to there too.
  const pinnedAnswerId = pokemonList[Math.floor(0.5 * pokemonList.length)].id

  const start = (): ReturnType<typeof createInitialState> =>
    createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))

  it('starts in the loading status with no guess', () => {
    const state = start()
    expect(state.status).toBe('loading')
    expect(state.guess).toBeNull()
    expect(state.streak).toBe(0)
    expect(state.bestStreak).toBeNull()
  })

  it('moves from loading to guessing when the image is ready', () => {
    const state = gameReducer(start(), { type: 'IMAGE_READY' })
    expect(state.status).toBe('guessing')
  })

  it('increments the streak on a correct guess', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })
    expect(state.status).toBe('revealed')
    expect(state.streak).toBe(1)
  })

  it('resets the streak to zero on a wrong guess', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    const wrong = state.options.find((o) => o !== state.pokemonId)!
    state = gameReducer(state, { type: 'GUESS', pokemonId: wrong })
    expect(state.streak).toBe(0)
  })

  it('records the best streak on a correct guess, not only on a wrong one', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })
    expect(state.bestStreak).toBe(1)
  })

  it('never lets the best streak decrease', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })
    const peak = state.bestStreak
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    const wrong = state.options.find((o) => o !== state.pokemonId)!
    state = gameReducer(state, { type: 'GUESS', pokemonId: wrong })
    expect(state.bestStreak).toBe(peak)
  })

  it('ignores a guess that arrives when not in the guessing status', () => {
    const state = start()
    expect(gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })).toBe(state)
  })

  it('adopts a stored best streak only when it beats the current one', () => {
    let state = gameReducer(start(), { type: 'HYDRATE_BEST', bestStreak: 9 })
    expect(state.bestStreak).toBe(9)
    state = gameReducer(state, { type: 'HYDRATE_BEST', bestStreak: 3 })
    expect(state.bestStreak).toBe(9)
  })

  it('returns to loading with a fresh pokemon on NEXT', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.77]) })
    expect(state.status).toBe('loading')
    expect(state.guess).toBeNull()
    expect(state.options).toHaveLength(4)
  })

  it('resolves the same pinned id components/Game.test.tsx relies on', () => {
    // Not a real assertion about game.ts behavior — a guard so a future
    // change to pokemonList's ordering fails loudly here instead of as a
    // confusing unrelated-looking failure in the component tests.
    expect(randomPokemon(() => 0.5).id).toBe(pinnedAnswerId)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- lib/game.test.ts`
Expected: FAIL — `lib/game.ts` still exports `MIN_DEX`/`MAX_DEX`/`randomDex`, and `GameState`/`GameAction` still use `dex`.

- [ ] **Step 3: Rewrite `lib/game.ts`**

Replace the entire file with:

```ts
import { pokemonList, type PokemonEntry } from './pokemonData'

export type Rng = () => number

export const randomPokemon = (rng: Rng): PokemonEntry =>
  pokemonList[Math.floor(rng() * pokemonList.length)]

const shuffle = <T,>(items: T[], rng: Rng): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export const generateOptions = (answerId: number, rng: Rng): number[] => {
  const options = new Set<number>([answerId])
  let guard = 0
  while (options.size < 4 && guard < 1000) {
    options.add(randomPokemon(rng).id)
    guard += 1
  }
  // A degenerate rng (e.g. one that always returns the same value) can leave
  // the loop above short of 4 unique options even after the guard trips.
  // Deterministically fill any remaining slots so the result is always
  // exactly 4 unique ids.
  let index = 0
  while (options.size < 4) {
    options.add(pokemonList[index].id)
    index = index >= pokemonList.length - 1 ? 0 : index + 1
  }
  return shuffle([...options], rng)
}

export type Status = 'loading' | 'guessing' | 'revealed'

export type GameState = {
  status: Status
  pokemonId: number
  options: number[]
  guess: number | null
  streak: number
  bestStreak: number | null
  // Monotonically incrementing per round. A repeat draw (possible any time
  // two rounds in a row land on the same entry) leaves `pokemonId` unchanged
  // across NEXT, which would otherwise give consuming components
  // (PokemonSilhouette) no signal that a new round started. `roundId` always
  // changes on NEXT regardless of which entry was drawn, so it — not
  // `pokemonId` — is the correct thing to key a fresh element on.
  roundId: number
}

export type GameAction =
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; pokemonId: number }
  | { type: 'NEXT'; rng: Rng }
  | { type: 'HYDRATE_BEST'; bestStreak: number }

const startRound = (rng: Rng): Pick<GameState, 'status' | 'pokemonId' | 'options' | 'guess'> => {
  const pokemonId = randomPokemon(rng).id
  return { status: 'loading', pokemonId, options: generateOptions(pokemonId, rng), guess: null }
}

export const createInitialState = (rng: Rng): GameState => ({
  ...startRound(rng),
  streak: 0,
  bestStreak: null,
  roundId: 0,
})

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'IMAGE_READY':
      return state.status === 'loading' ? { ...state, status: 'guessing' } : state

    case 'GUESS': {
      if (state.status !== 'guessing') return state
      const correct = action.pokemonId === state.pokemonId
      const streak = correct ? state.streak + 1 : 0
      return {
        ...state,
        status: 'revealed',
        guess: action.pokemonId,
        streak,
        bestStreak: Math.max(streak, state.bestStreak ?? 0),
      }
    }

    case 'NEXT':
      return { ...state, ...startRound(action.rng), roundId: state.roundId + 1 }

    case 'HYDRATE_BEST':
      return { ...state, bestStreak: Math.max(action.bestStreak, state.bestStreak ?? 0) }

    default:
      return state
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- lib/game.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add lib/game.ts lib/game.test.ts
git commit -m "Rework lib/game.ts to select by list index instead of a contiguous dex range"
```

---

## Task 5: Update components for the `pokemonId` rename and new sprite source

**Files:**
- Modify: `components/PokemonSilhouette.tsx`
- Modify: `components/Game.tsx`
- Modify: `components/GuessGrid.tsx`
- Modify: `components/GuessButton.tsx`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `GameState`, `GameAction`, `createInitialState`, `gameReducer`, `Rng` from `lib/game.ts` (Task 4); `getPokemonName`, `getSpeciesDex` from `lib/pokemon.ts` (Task 3)
- Produces: no new exports — this task is a mechanical prop/field rename plus the sprite URL swap. Task 6 (component tests) is the verification for it.

- [ ] **Step 1: `next.config.ts` — point at the new sprite host**

Change the `remotePatterns` entry:

```ts
{
  protocol: 'https',
  hostname: 'raw.githubusercontent.com',
  pathname: '/PokeAPI/sprites/**',
},
```

- [ ] **Step 2: `components/PokemonSilhouette.tsx` — new sprite base, `pokemonId` prop**

```ts
import formatDexNumber from '@/lib/formatDexNumber'
import { getPokemonName } from '@/lib/pokemon'
```
becomes
```ts
import { getPokemonName, getSpeciesDex } from '@/lib/pokemon'
```

```ts
const SPRITE_BASE =
  'https://raw.githubusercontent.com/rafavalerio/pokemon-sprites/master/images'
```
becomes
```ts
const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'
```

```ts
type Props = {
  dex: number
  roundId: number
  status: 'loading' | 'guessing' | 'revealed'
  onReady: () => void
}

const PokemonSilhouette = ({ dex, roundId, status, onReady }: Props) => {
```
becomes
```ts
type Props = {
  pokemonId: number
  roundId: number
  status: 'loading' | 'guessing' | 'revealed'
  onReady: () => void
}

const PokemonSilhouette = ({ pokemonId, roundId, status, onReady }: Props) => {
```

```ts
        src={`${SPRITE_BASE}/${formatDexNumber(dex)}.png`}
        alt={revealed ? `${getPokemonName(dex)}, number ${dex}` : 'Hidden Pokémon silhouette'}
```
becomes
```ts
        src={`${SPRITE_BASE}/${pokemonId}.png`}
        alt={
          revealed
            ? `${getPokemonName(pokemonId)}, number ${getSpeciesDex(pokemonId)}`
            : 'Hidden Pokémon silhouette'
        }
```

Everything else in the file (the drag/callout/context-menu guards, the placeholder pokeball, the className logic) is unchanged — this task only touches the sprite source and the `dex` → `pokemonId` naming.

- [ ] **Step 3: `components/GuessButton.tsx` — rename the `dex` prop**

```ts
type Props = {
  dex: number
  state: GuessState
  disabled: boolean
  onClick: () => void
}

const GuessButton = ({ dex, state, disabled, onClick }: Props) => (
  <button type="button" onClick={onClick} disabled={disabled} className={guessButtonClassName(state)}>
    {state === 'correct' && <Check className="size-4 shrink-0" aria-hidden="true" />}
    {state === 'wrong' && <X className="size-4 shrink-0" aria-hidden="true" />}
    <span className="truncate">{getPokemonName(dex)}</span>
  </button>
)
```
becomes
```ts
type Props = {
  pokemonId: number
  state: GuessState
  disabled: boolean
  onClick: () => void
}

const GuessButton = ({ pokemonId, state, disabled, onClick }: Props) => (
  <button type="button" onClick={onClick} disabled={disabled} className={guessButtonClassName(state)}>
    {state === 'correct' && <Check className="size-4 shrink-0" aria-hidden="true" />}
    {state === 'wrong' && <X className="size-4 shrink-0" aria-hidden="true" />}
    <span className="truncate">{getPokemonName(pokemonId)}</span>
  </button>
)
```

- [ ] **Step 4: `components/GuessGrid.tsx` — rename `dex` to `pokemonId` throughout**

```ts
type Props = {
  options: number[]
  answer: number
  guess: number | null
  revealed: boolean
  disabled: boolean
  onGuess: (dex: number) => void
}

const stateFor = (
  dex: number,
  answer: number,
  guess: number | null,
  revealed: boolean,
): GuessState => {
  if (!revealed) return 'idle'
  if (dex === answer) return 'correct'
  return dex === guess ? 'wrong' : 'idle'
}

const GuessGrid = ({ options, answer, guess, revealed, disabled, onGuess }: Props) => (
  <div className="grid grid-cols-2 gap-2">
    {options.map((dex) => (
      <GuessButton
        key={dex}
        dex={dex}
        state={stateFor(dex, answer, guess, revealed)}
        disabled={disabled}
        onClick={() => onGuess(dex)}
      />
    ))}
  </div>
)
```
becomes
```ts
type Props = {
  options: number[]
  answer: number
  guess: number | null
  revealed: boolean
  disabled: boolean
  onGuess: (pokemonId: number) => void
}

const stateFor = (
  pokemonId: number,
  answer: number,
  guess: number | null,
  revealed: boolean,
): GuessState => {
  if (!revealed) return 'idle'
  if (pokemonId === answer) return 'correct'
  return pokemonId === guess ? 'wrong' : 'idle'
}

const GuessGrid = ({ options, answer, guess, revealed, disabled, onGuess }: Props) => (
  <div className="grid grid-cols-2 gap-2">
    {options.map((pokemonId) => (
      <GuessButton
        key={pokemonId}
        pokemonId={pokemonId}
        state={stateFor(pokemonId, answer, guess, revealed)}
        disabled={disabled}
        onClick={() => onGuess(pokemonId)}
      />
    ))}
  </div>
)
```

- [ ] **Step 5: `components/Game.tsx` — thread `pokemonId` through**

```tsx
          <PokemonSilhouette
            dex={state.dex}
            roundId={state.roundId}
            status={state.status}
            onReady={handleReady}
          />
```
becomes
```tsx
          <PokemonSilhouette
            pokemonId={state.pokemonId}
            roundId={state.roundId}
            status={state.status}
            onReady={handleReady}
          />
```

```tsx
      <p className="text-ink mb-4 h-6 text-center text-sm font-semibold tabular-nums">
        {revealed ? `#${state.dex} · ${getPokemonName(state.dex)}` : ' '}
      </p>
```
becomes
```tsx
      <p className="text-ink mb-4 h-6 text-center text-sm font-semibold tabular-nums">
        {revealed ? `#${getSpeciesDex(state.pokemonId)} · ${getPokemonName(state.pokemonId)}` : ' '}
      </p>
```

```tsx
        <GuessGrid
          options={state.options}
          answer={state.dex}
          guess={state.guess}
          revealed={revealed}
          disabled={state.status !== 'guessing'}
          onGuess={(dex) => dispatch({ type: 'GUESS', dex })}
        />
```
becomes
```tsx
        <GuessGrid
          options={state.options}
          answer={state.pokemonId}
          guess={state.guess}
          revealed={revealed}
          disabled={state.status !== 'guessing'}
          onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId })}
        />
```

```tsx
        {revealed && state.guess !== state.dex ? 'Start again' : 'Next'}
```
becomes
```tsx
        {revealed && state.guess !== state.pokemonId ? 'Start again' : 'Next'}
```

And the import line:
```ts
import { getPokemonName } from '@/lib/pokemon'
```
becomes
```ts
import { getPokemonName, getSpeciesDex } from '@/lib/pokemon'
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: no errors. (Tests are still failing at this point — `components/Game.test.tsx` hasn't been updated yet, that's Task 6 — but the types across all four components plus `lib/game.ts`/`lib/pokemon.ts` must already agree.)

- [ ] **Step 7: Commit**

```bash
git add components/PokemonSilhouette.tsx components/Game.tsx components/GuessGrid.tsx components/GuessButton.tsx next.config.ts
git commit -m "Rename dex to pokemonId through the component tree, point sprites at PokeAPI"
```

---

## Task 6: Update `components/Game.test.tsx`

**Files:**
- Modify: `components/Game.test.tsx`

**Interfaces:**
- Consumes: `pokemonList` from `lib/pokemonData.ts` (Task 2), `getPokemonName` from `lib/pokemon.ts` (Task 3), `Game` from `components/Game.tsx` (Task 5)

The test file pins `Math.random` to `0.5` and hardcodes `453` as the id that resolves to under the old `MIN_DEX + floor(0.5 * (MAX_DEX - MIN_DEX + 1))` formula (dex 1–905 only). Rather than hand-compute the new equivalent constant (which is sensitive to the exact final size of `pokemonList`, and would silently go stale the next time `npm run pokemon:build` is re-run against updated PokeAPI data), derive it the same way `randomPokemon` does, from the real generated list.

- [ ] **Step 1: Add the import and the derived constant**

At the top of `components/Game.test.tsx`, add:

```ts
import { pokemonList } from '@/lib/pokemonData'
```

Inside `describe('Game', ...)`, before `beforeEach`, add:

```ts
  // Math.random is pinned to 0.5 for every call in this file (see
  // beforeEach), and lib/game.ts's randomPokemon does
  // `pokemonList[Math.floor(rng() * pokemonList.length)]` — mirror that here
  // so this constant tracks lib/pokemonData.ts automatically instead of
  // going stale the next time the data is regenerated.
  const pinnedAnswerId = pokemonList[Math.floor(0.5 * pokemonList.length)].id
```

- [ ] **Step 2: Replace every literal `453` with `pinnedAnswerId`**

There are seven occurrences (the `for (const dex of [453, 1, 2, 3])` loop, and six `getPokemonName(453)` calls). Replace each `453` with `pinnedAnswerId`. In the loop, also rename the loop variable for clarity:

```ts
    for (const dex of [453, 1, 2, 3]) {
      expect(screen.queryByText(getPokemonName(dex))).not.toBeInTheDocument()
    }
```
becomes
```ts
    for (const id of [pinnedAnswerId, 1, 2, 3]) {
      expect(screen.queryByText(getPokemonName(id))).not.toBeInTheDocument()
    }
```

Every other occurrence is `getPokemonName(453)` → `getPokemonName(pinnedAnswerId)`, unchanged otherwise.

- [ ] **Step 3: Update the comment referencing the old ~1-in-905 odds**

```ts
    // Math.random is pinned to 0.5 for every call in this test file, so every
    // round draws the same dex (453). This reproduces the exact scenario a
    // real ~1-in-905 repeat draw would hit: if the round's identity is keyed
    // on `dex` instead of a value that changes every NEXT, the silhouette
    // never remounts, no load event fires, and the round is stuck in
    // 'loading' forever — GUESS is rejected and Next stays disabled.
```
becomes
```ts
    // Math.random is pinned to 0.5 for every call in this test file, so every
    // round draws the same pokemonId (pinnedAnswerId). This reproduces the
    // scenario a real repeat draw would hit: if the round's identity is keyed
    // on `pokemonId` instead of a value that changes every NEXT, the
    // silhouette never remounts, no load event fires, and the round is stuck
    // in 'loading' forever — GUESS is rejected and Next stays disabled.
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- components/Game.test.tsx`
Expected: PASS (all tests). If any assertion around "the wrong option" fails, re-check that `generateOptions`'s fallback fill (Task 4, `lib/game.ts`) still produces a low, predictable id under a degenerate rng — the test comments explain why that matters.

- [ ] **Step 5: Run the full test suite, lint, and typecheck**

```bash
npm run lint
npm run typecheck
npm test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add components/Game.test.tsx
git commit -m "Update Game.test.tsx for the pokemonId rename, deriving the pinned test id from pokemonList"
```

---

## Task 7: Update CLAUDE.md and README.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: `CLAUDE.md` — architecture section**

Update:
```
**`lib/pokemon.ts`** is a flat array of 905 names indexed by dex number;
`lib/formatDexNumber.ts` zero-pads for the sprite URL.
```
to:
```
**`lib/pokemonData.ts`** is a generated file (via `npm run pokemon:build`,
`scripts/build-pokemon-data.mjs`) listing every base species (dex 1–1025) plus
in-scope alternate forms — Mega Evolutions, regional forms (Alolan/Galarian/
Hisuian/Paldean), and Gigantamax forms — each as a `PokemonEntry { id, name,
speciesDex }`. `id` doubles as the sprite filename; `speciesDex` is the
national dex number a form shares with its base species. `lib/pokemon.ts` is
the hand-maintained lookup layer over it (`getPokemonEntry`, `getPokemonName`,
`getSpeciesDex`), keyed by `id` rather than array index since ids are no
longer contiguous once forms are included.
```

- [ ] **Step 2: `CLAUDE.md` — "Why `roundId` exists" section**

Update every `dex` reference to `pokemonId`:
```
`GameState.roundId` increments on every `NEXT`. A repeat dex draw (~1 in 905)
would leave `dex` unchanged, so an `<img>` keyed on `dex` would not remount, no
`load` event would fire, and the round would be stranded in `'loading'` forever.
Key and re-run effects on `roundId`, never on `dex`.
```
to:
```
`GameState.roundId` increments on every `NEXT`. A repeat draw would leave
`pokemonId` unchanged, so an `<img>` keyed on `pokemonId` would not remount, no
`load` event would fire, and the round would be stranded in `'loading'`
forever. Key and re-run effects on `roundId`, never on `pokemonId`.
```

- [ ] **Step 3: `README.md` — sprite source**

Update:
```
Sprites for dex 1–905 are served from
[rafavalerio/pokemon-sprites](https://github.com/rafavalerio/pokemon-sprites).
```
to:
```
Sprites are served from the `official-artwork` folder of
[PokeAPI/sprites](https://github.com/PokeAPI/sprites). The full list — base
species plus Megas, regional forms, and Gigantamax forms — is generated from
PokeAPI's REST API by `scripts/build-pokemon-data.mjs` (`npm run
pokemon:build`) into `lib/pokemonData.ts`, checked in rather than fetched at
runtime.
```

- [ ] **Step 4: `README.md` — layout map**

Update:
```
lib/           Pure game logic, the 905-name table, dex formatting
```
to:
```
lib/           Pure game logic, the generated Pokémon list and its lookup helpers
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Update docs for the PokeAPI sprite source and the id/pokemonId rename"
```

---

## Task 8: Full verification pass

**Files:** none modified — this is a checkpoint task.

- [ ] **Step 1: Run the full check suite**

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all four pass. `npm run build` matters here specifically because it's the only command that exercises static generation, and this plan changed what `lib/game.ts`'s lazy initializer produces.

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open the app, and check:
- A silhouette loads and reveals a real sprite (not a broken image) on guess.
- At least one round shows a Mega/regional/Gigantamax name in the options or as the answer — since the pool is now ~1200 entries with ~180 forms mixed in with ~1025 base species, this should turn up within a handful of rounds; if it doesn't show up in ~15 rounds, something is wrong with the form data reaching the game.
- The revealed label reads `#<speciesDex> · <name>` correctly for both a base species and a form.

Stop the dev server once confirmed.

- [ ] **Step 3: Report**

No commit for this task — it's a verification gate. If everything passes, the plan is complete.
