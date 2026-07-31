# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Pokéguess: a single-screen game that shows a Pokémon silhouette and four name
options. Next 16 App Router, React 19, TypeScript 6, Tailwind v4, Vitest.
There is no backend, no database and no API route — sprites come from a static
GitHub repo, and the only persisted state is `bestStreak` in `localStorage`.

## Commands

```bash
npm run dev           # dev server on :3000
npm run build         # production build (also type-checks)
npm run lint          # oxlint
npm run typecheck     # tsc --noEmit
npm test              # vitest run
npm run test:watch    # vitest in watch mode
npm run pokemon:build # regenerate lib/pokemonData.ts from PokeAPI
```

Requires Node 22 (`.nvmrc`, `engines`). Run `nvm use` first.

Before claiming work is done, run `npm run lint`, `npm run typecheck` and
`npm test`. `npm run build` is worth running too when the change touches
rendering, since it is the only check that exercises static generation.

## Architecture

**Game logic is pure and lives in `lib/game.ts`** — a reducer plus helpers, with
the random number generator passed in as an `Rng` argument rather than calling
`Math.random` internally. This is what makes the tests deterministic: they pass
a seeded or scripted `rng`. Keep it that way; do not import `Math.random` into
`lib/`.

**`components/Game.tsx` is the only stateful component.** It owns the reducer
and composes the presentational components (`GuessGrid`, `GuessButton`,
`PokemonSilhouette`, `ScoreBoard`, `PokedexShell`) around it. Those components
hold no game state of their own — if you find yourself adding `useState` to one
of them, the state probably belongs in the reducer.

**`lib/pokemonData.ts`** is a generated file (via `npm run pokemon:build`,
`scripts/build-pokemon-data.mjs`) listing every base species (dex 1–1025) plus
in-scope alternate forms — Mega Evolutions, regional forms (Alolan/Galarian/
Hisuian/Paldean), and Gigantamax forms — each as a `PokemonEntry { id, name,
speciesDex }`. `id` doubles as the sprite filename; `speciesDex` is the
national dex number a form shares with its base species. `lib/pokemon.ts` is
the hand-maintained lookup layer over it (`getPokemonEntry`, `getPokemonName`,
`getSpeciesDex`), keyed by `id` rather than array index since ids are no
longer contiguous once forms are included.

**`lib/gameConfig.ts`** holds the tunable difficulty numbers — `DIFFICULTY_CURVE`
(how many "hard" distractors appear per streak band), `DEX_PROXIMITY` and
`SIMILARITY_THRESHOLD` (what counts as a "hard" distractor). Retuning
difficulty is an edit to this file, not to `lib/game.ts`'s logic.

### The hydration constraint

This is the single most important thing to understand before editing `Game.tsx`
or `PokemonSilhouette.tsx`.

The first round is drawn during render, inside `useReducer`'s lazy initializer.
That runs on both the server and the client, and draws a *different* Pokémon in
each place. So **nothing derived from that draw may be rendered before mount**,
or hydration fails with a text/attribute mismatch.

The gate is `useMounted()`, built on `useSyncExternalStore` (server snapshot
`false`, client snapshot `true`) rather than a `setState` in an effect.
`SilhouettePlaceholder` and `GuessGridPlaceholder` reserve the exact footprint
of the real content so nothing shifts when it swaps in.

If you add anything derived from `state.pokemonId` or `state.options` to the tree,
it has to sit behind the `mounted` check.

### Why `roundId` exists

`GameState.roundId` increments on every `NEXT`. A repeat draw would leave
`pokemonId` unchanged, so an `<img>` keyed on `pokemonId` would not remount, no
`load` event would fire, and the round would be stranded in `'loading'`
forever. Key and re-run effects on `roundId`, never on `pokemonId`.

### No-repeat draws and winning

`GameState.usedIds` tracks every Pokémon drawn as the answer during the
current unbroken streak ("run"); the next draw excludes it
(`randomPokemonExcluding`), so the same Pokémon never repeats within a run.
It resets on the first `NEXT` after a run ends (a wrong guess). If a run's `usedIds` ever
grows to cover the entire `pokemonList`, that's a win: `Status` gains
`'won'`, set on the `NEXT` after the last correct guess (not on the `GUESS`
itself, so the final reveal is still shown first) — no new round is drawn at
that point, so `roundId` is untouched by it.

### Hiding the answer

The unrevealed sprite is the real image under a `brightness-0` CSS filter, not a
separate asset. Any browser affordance that renders the raw image — long-press
callout, drag preview, "open image in new tab" — leaks the answer, which is why
`PokemonSilhouette` carries `pointer-events-none`, `draggable={false}`,
`-webkit-touch-callout`, `-webkit-user-drag` and an `onContextMenu` guard. Do
not remove those as "redundant"; they cover engines that treat callout and
native drag separately from pointer events.

## Conventions

- No semicolons, single quotes, 2-space indent. Match the surrounding file.
- Components are arrow functions with a default export; `type Props = {...}`
  declared just above.
- `@/*` path alias maps to the repo root.
- Colours and animations are Tailwind v4 `@theme` tokens in `app/globals.css`
  (`bg-screen-sunk`, `text-ink-soft`, `animate-sprite-pop`, …). Add a token
  there rather than hard-coding a hex value in a class.
- **Type is Onest**, loaded as a variable font in `app/layout.tsx` and wired in
  through `--font-sans`, so it applies page-wide with no `font-*` class on
  `<body>`. The scale in use is 400 body, 500 labels and options, 600 stat
  values and the revealed name, 700 the title. Counters and the dex number
  carry `tabular-nums` so they do not change width as they change value.
- **Interactive state goes behind `enabled:`** — `enabled:cursor-pointer`,
  `enabled:hover:*`, `enabled:active:*`. A disabled button still matches
  `:hover` in CSS, so an ungated hover would light up the revealed answers and
  the loading skeletons as if they were live. Tailwind v4 also drops the
  browser's default `cursor: pointer` on buttons, so a new button needs
  `enabled:cursor-pointer` spelled out or it will show an arrow.
- Tailwind v4 already wraps the `hover:` variant in `@media (hover: hover)`, so
  hover styling is desktop-only for free — do not hand-roll that media query.
- `prefers-reduced-motion` is handled globally in `globals.css` and covers all
  animations and transitions — no need to repeat it per component.
- Comments explain *why*, not what, and the existing ones are load-bearing
  documentation of the constraints above. Preserve them when refactoring.

## Tests

`lib/game.test.ts` covers the reducer with scripted `rng` functions.
`components/Game.test.tsx` drives the rendered game with React Testing Library
and `user-event`. Tests query by role and accessible name, so changing
`aria-hidden`, labels or roles can break them even when the UI looks identical —
check the intent of the assertion before changing markup semantics.

## Dependencies

All ranges are carets resolved by the committed lockfile; `npm audit` is at
zero. Linting is oxlint (`.oxlintrc.json`) rather than ESLint, because
`eslint-config-next` was forcing three version pins and nine unfixable
advisories. **Do not reintroduce `eslint-config-next`**, and do not run
`npm audit fix --force` — it still proposes downgrading `next` to 9.3.3.

The `overrides` for `postcss` and `sharp` are required: Next 16.2 depends on
vulnerable versions of both. See the README for the full reasoning and the
conditions under which each remaining constraint can be lifted.
