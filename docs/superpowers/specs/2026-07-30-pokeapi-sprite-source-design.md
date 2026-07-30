# Switch to the PokeAPI sprite source, and add megas/regional forms/gigantamax

## Why

The current Pokémon list (`lib/pokemon.ts`) stops at dex 905 (end of Gen 8),
and sprites come from a personal fork (`rafavalerio/pokemon-sprites`) that
isn't kept in sync with new games. The
[PokeAPI/sprites](https://github.com/PokeAPI/sprites) repo's
`official-artwork` folder has the current full national dex (1–1025, through
the Scarlet/Violet Indigo Disk DLC) plus artwork for alternate forms, and
[PokeAPI](https://pokeapi.co/) exposes the metadata needed to build a name
list for it. This is also step one toward region/generation filters and cries
later — this spec only covers the list and sprite source.

## Scope

In scope: base species (dex 1–1025), Mega Evolutions, regional forms (Alolan,
Galarian, Hisuian, Paldean), and Gigantamax forms.

Out of scope (explicitly excluded, not "maybe later" — re-evaluate if this
changes): shiny sprites, gender-difference forms, cosmetic-only forms (Unown,
Vivillon, Alcremie flavors, Arceus/Silvally types, etc.), and battle/forme
changes (Deoxys's attack/defense/speed, Necrozma's dusk-mane/dawn-wings,
Darmanitan's Zen mode, totem forms, Rotom's appliance forms, etc.).

## How the source repo is laid out

`PokeAPI/sprites`'s `official-artwork` folder names files by a numeric id,
unpadded (`1.png`, `25.png`), in two ranges:

- **1–1025**: the plain national dex number — one file per base species.
- **10001+**: PokeAPI's internal "pokemon id" for alternate forms (not
  sequential with the dex). 314 of these exist today; they need PokeAPI
  metadata to resolve to a name and a species dex number.

A parallel `official-artwork/shiny/` folder mirrors the same id scheme but is
unused here (out of scope).

## Data pipeline

A generation script, not a runtime dependency: `scripts/build-pokemon-data.mjs`,
run manually (`npm run pokemon:build`) and re-run whenever a new game adds
more species or forms. Plain Node (no new dependency — Node 22 has native
`fetch`).

Two sequential PokeAPI calls cover the entire dataset — verified as complete,
single-page responses (`next: null`, `results.length` equal to `count`) and
small (91 KB / 75 KB):

1. `GET /pokemon-species?limit=2000` → all 1025 base species names; each
   result's URL encodes its id, which is also its national dex number.
2. `GET /pokemon?limit=2000` → all 1351 pokémon resources (species + every
   form PokeAPI tracks). Filter `name` by suffix against the in-scope set
   (`-mega`, `-mega-x`, `-mega-y`, `-gmax`, `-alola`, `-galar`, `-hisui`,
   `-paldea`, including compound names like `-paldea-combat-breed`), then
   exclude any match that also contains `totem`, `zen`, or `cap` (these ride
   on an in-scope suffix — e.g. `raticate-totem-alola`,
   `darmanitan-galar-zen`, `pikachu-alola-cap` — but are out-of-scope
   battle/cosmetic forms, not regional forms in their own right). For each
   surviving match, strip the suffix to get the base species name, look up
   its dex number from step 1's map, and take the numeric id from the
   resource's own URL as this entry's id (and sprite filename).

Two requests total is about as light a footprint on PokeAPI as this can have,
so no artificial delay/backoff is needed beyond not parallelizing the two
calls.

Before writing the output file, the script prints a summary (counts by
category, and the full matched list) so the filtering can be eyeballed for
mistakes — PokeAPI's form-naming has enough edge cases (see above) that a
manual sanity check before commit is worth doing every time the script runs.

## Data shape

Output: `lib/pokemonData.ts`, a generated file (banner comment marking it as
such — hand edits will be overwritten next run):

```ts
export type PokemonEntry = {
  id: number // PokeAPI pokemon id; also the official-artwork filename
  name: string // display name, e.g. "Bulbasaur", "Mega Venusaur", "Alolan Raichu"
  speciesDex: number // national dex number, shared by a species and all its forms
}

export const pokemonList: readonly PokemonEntry[] = [ /* ~1200 entries */ ]
```

`lib/pokemon.ts` keeps its current role and import path (`@/lib/pokemon`) as
the hand-maintained helper module, but its internals move from indexing a
flat name array by dex number to looking entries up from `pokemonList` by id
(ids are no longer contiguous once forms are included, so this is a `Map`
lookup, not array indexing).

## Game state and identifier rename

Forms share a species dex number with their base form, so `dex` can no longer
double as a unique identifier — a round could draw "Venusaur" or "Mega
Venusaur", both dex 3. This is a rename through `lib/game.ts`,
`components/Game.tsx`, `GuessButton.tsx`, `PokemonSilhouette.tsx`, and both
test files:

- `GameState.dex` → `GameState.pokemonId`, holding a `PokemonEntry.id`.
- `MIN_DEX` / `MAX_DEX` / `randomDex` → replaced by index-based selection
  over `pokemonList` (a `randomPokemon(rng)` that picks a random entry).
  `generateOptions` changes the same way: it currently fills gaps by walking
  the contiguous `MIN_DEX..MAX_DEX` range; it needs to walk `pokemonList`
  indices instead, since ids are sparse.
- `getPokemonName(id)` and a new `getSpeciesDex(id)` (or a single
  `getPokemonEntry(id)` that both call sites destructure) replace the
  `pokemonNames[dex - 1]` array-index lookup with a `Map` lookup by id.
- The revealed label becomes `${name}, number ${speciesDex}` for both base
  species and forms — e.g. "Mega Venusaur, number 3" — per explicit decision
  to always show the species number, not a form-specific number.

`formatDexNumber.ts` is deleted: it exists only to zero-pad the sprite
filename for the current sprite fork, and the new source's filenames are
unpadded, so nothing calls it once `PokemonSilhouette` switches sprite
sources.

## Sprite source

`PokemonSilhouette.tsx`'s `SPRITE_BASE` changes to
`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork`,
and the URL builds as `${SPRITE_BASE}/${pokemonId}.png` (no padding).
`next.config.ts`'s `images.remotePatterns` pathname changes from
`/rafavalerio/pokemon-sprites/**` to `/PokeAPI/sprites/**`.

If PokeAPI knows about a form id that has no matching `official-artwork` file
(not expected for the in-scope categories, but not verified file-by-file
either), the existing `onError={onReady}` handling on the `<Image>` already
treats a failed sprite load as "ready" rather than stranding the round, so
this degrades gracefully rather than breaking the game.

## Docs and tests

CLAUDE.md's architecture section (`lib/pokemon.ts` description) and the "Why
`roundId` exists" section (which currently reads in terms of `dex`) get
updated for the new field names, the generation script, and the larger,
non-contiguous list.

`lib/game.test.ts` and `components/Game.test.tsx` get updated for the renamed
action field (`GUESS`'s `dex` → `pokemonId`) and helpers. Test intent is
unchanged — they're scripted-`rng` tests asserting the same reducer/hydration
behavior against the new API shape.
