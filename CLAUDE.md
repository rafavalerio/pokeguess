# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Pokéguess: a single-screen game that shows a Pokémon silhouette and four name
options. Next 16 App Router, React 19, TypeScript 6, Tailwind v4, Vitest.
There is no backend, no database and no API route — sprites come from a static
GitHub repo, and the only persisted state is `bestStreak` (per generation),
`streak`, `usedIds`, `selectedGeneration` and `includeVariants` in
`localStorage`.

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
`PokemonSilhouette`, `RunRecap`, `ScoreBoard`, `PokedexShell`, `MainMenu`)
around it. Those components hold no game state of their own — if you find
yourself adding `useState` to one of them, the state probably belongs in the
reducer.

Game.tsx also owns plain (non-reducer) state: `view` (`'menu' | 'stats' |
'game'`), which screen is showing, and `selectedGeneration`/`includeVariants`
(see "Generation selection" below), the menu's pool pickers. `view` starts on
`'menu'` — a main menu / hub with the title, a Play button, and a Stats
button — and switches to `'game'` to show the existing single-round UI
unchanged. All three deliberately sit outside `GameState`: they're
pre-game/screen state, not round logic, and all default identically on server
and client (`'menu'`, `'all'`, `false`), so none carries the hydration risk
`pokemonId`/`options` do. The title only renders on `MainMenu` (`view !==
'game'`); the game screen's header is just the "Who's that Pokémon?" line,
sized up a step since it's no longer sitting under a heading.

The game screen has a Home button (top right, next to `PokedexShell`'s lamps)
that sets `view` back to `'menu'` without touching the reducer, so an
in-progress run keeps its `pokemonId`/`options`/`status` in memory — the same
round is still there if the player returns via Continue. Once a run is in
progress (`streak > 0`), the menu swaps its generation `<select>`/checkbox for
a "current run" summary (generation, includeVariants, streak — all read
straight off `GameState`/component state, not re-derived) and its single Play
button for Continue (same handler as Play — the reducer already holds the
right state either way) and Start again. Unlike Continue, Start again
dispatches `RESTART` (a full reset, the same shape `NEXT` produces from the
win screen or a broken streak) but deliberately does *not* switch `view` to
`'game'` — it resets the streak and stays on the menu, so `canContinue` goes
back to `false` and the picker reappears immediately for a fresh pick, rather
than forcing a detour through the game screen and back via Home.

**`PokedexShell`'s top-right corner holds one `cornerAction`** (`{ icon,
label, onClick }`), not separate `onHome`/`onBack` props — Home (game screen)
and Back (stats screen) are never both relevant at once, so `Game.tsx` picks
whichever fits the current `view` and the button markup/styling is defined
exactly once. The stats screen (`mode === 'stats'` in `MainMenu`) also swaps
the title/subtitle block for a plain "Stats" heading sitting close to the top
(`pt-1` instead of the menu's `py-10`) instead of inheriting the menu's
centered layout, and no longer renders its own bottom Back button — that
moved into `cornerAction`.

**`lib/pokemonData.ts`** is a generated file (via `npm run pokemon:build`,
`scripts/build-pokemon-data.mjs`) listing every base species (dex 1–1025) plus
in-scope alternate forms — Mega Evolutions, regional forms (Alolan/Galarian/
Hisuian/Paldean), and Gigantamax forms — each as a `PokemonEntry { id, name,
speciesDex, generation }`. `id` doubles as the sprite filename; `speciesDex`
is the national dex number a form shares with its base species, used for the
"same family" hard-distractor grouping. `generation` is the generation *that
entry* was introduced in, which for a form is frequently later than its base
species' — Mega Charizard X is `generation: 6` despite Charizard being
`generation: 1` — computed via `FORM_GENERATION_BY_KIND` in the generator
script rather than derived from `speciesDex` (see "Generation selection"
below). `lib/pokemon.ts` is the hand-maintained lookup layer over it
(`getPokemonEntry`, `getPokemonName`, `getSpeciesDex`, `getSpriteUrl`), keyed
by `id` rather than array index since ids are no longer contiguous once forms
are included. `getSpriteUrl` is the one piece shared with `PokemonSilhouette`
and `RunRecap` — both render a sprite for a given id, just at different sizes
and reveal states, so the URL pattern lives here rather than being
duplicated.
`lib/generationDexRanges.json` is the shared source of truth for base-species
generation boundaries — read directly by the (plain, non-TypeScript) build
script and imported by `lib/generations.ts`, which layers display labels on
top.

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

`streak` and `usedIds` are persisted to `localStorage` alongside `bestStreak`
(`components/Game.tsx`) so a refresh mid-run doesn't lose progress. Restoring
them happens the same way `bestStreak` is restored — a `HYDRATE_RUN` action
dispatched from a mount effect, after the initial (server-matching) round has
already rendered, so it doesn't trip the hydration constraint above. Because
the initial round was drawn with an empty exclusion set, `HYDRATE_RUN` redraws
the round against the restored `usedIds` — same as a normal `NEXT` — rather
than trusting the pre-hydration draw not to collide with a restored id.

### The run recap screen

Once a wrong guess ends a run, `Game.tsx` renders `RunRecap` in place of both
the silhouette/name/`GuessGrid` trio *and* `ScoreBoard` (hidden for this one
screen — see below), instead of the single-round inline reveal those
normally show. It's a read-only summary: which generation the run was played
in, the run's final streak alongside the all-time best (highlighted if this
run just set a new one), every correctly guessed Pokémon this run (name +
small sprite, oldest first), then the missed answer and what was guessed
instead. `Game.tsx` computes this as one `missedGuess` value — `null` when it
doesn't apply, otherwise `{ generationLabel, correctEntries, bestStreak,
isNewBest, missedAnswer, guessedAnswer }` — rather than a separate boolean
plus re-reading `state.guess` at the render site, so TypeScript narrows
`state.guess` (`number | null`) to `number` once instead of needing a second
null check (or a cast) in the JSX. `ScoreBoard` is skipped
(`{!missedGuess && <ScoreBoard .../>}`) only in this state — it still shows
normally mid-round and on the win screen. `generationLabel` is resolved from
`GENERATION_SELECT_OPTIONS` the same way `MainMenu`'s "current run" summary
does, so the two never describe the pool differently.

The streak box's two numbers sit in a `grid-cols-2` (not `flex` + `gap`), so
"Final streak" and "Best" each get an equal half regardless of one label
being longer than the other — a `flex` layout there sized each column to its
content, which visibly off-centered the divider and the numbers under it.

`correctEntries` is derived from `state.usedIds` minus `state.pokemonId`:
`usedIds` already contains the id of the round just guessed wrong (added when
that round was drawn, before it was guessed), so excluding it leaves exactly
the ids guessed correctly so far this run, in draw order. This is also why
the recap's own "Final streak" number — `correctEntries.length` — is used
instead of `state.streak`: `GUESS` zeroes `state.streak` immediately on a
wrong guess (before `NEXT` is even dispatched), so by the time the recap
renders, `state.streak` already reads `0`. Hiding `ScoreBoard` here is what
lets the recap use the clearer, non-conflicting "Final streak" label instead
of reusing `ScoreBoard`'s "Streak" label for a different number.

**`GameState.isNewBest`** tracks whether the most recent *correct* guess
pushed `bestStreak` strictly past what it was before that guess — not merely
tied it. Set in the `GUESS` case (`correct ? streak > priorBest :
state.isNewBest`): a wrong guess never raises `bestStreak`, so it carries the
flag forward from the last correct guess rather than recomputing (and
wrongly clearing) it, which is what lets the recap answer "did this run set a
new record" after the run has already ended. Reset to `false` at the start of
every run (`createInitialState`, `restart`, both `HYDRATE_RUN` branches) —
without that reset a fresh run would inherit whatever the previous run last
computed.

`RunRecap` has no button of its own. The persistent advance button at the
bottom of the game screen already reads "Start again" and dispatches `NEXT`
in this state (which behaves like `RESTART` once `streak` is already `0` —
see the `NEXT` case in `lib/game.ts`), so the recap doesn't duplicate it.

### Generation selection

**`lib/generations.ts`** defines `GENERATIONS` (national dex ranges, for
display labels and `generationForDex`'s defensive fallback only — see below)
and `pokemonPoolFor(filter, includeVariants)`, where `filter` is `GameState`'s
`generation: GenerationFilter` field (`'all' | number`) and `includeVariants`
is its `includeVariants: boolean` field. A form is filtered by *its own*
`generation` (see the `lib/pokemonData.ts` paragraph above), not its base
species' — a Generation 1-scoped run never includes Mega Charizard X, since
that entry's `generation` is 6. `includeVariants: false` additionally
restricts the pool to base species (`entry.id === entry.speciesDex`); a form
is only ever in scope when the toggle is on, regardless of which generation
is selected. Every draw function in `lib/game.ts` (`randomPokemon`,
`randomPokemonExcluding`, `generateOptions`, `startRound`) takes the candidate
pool as an explicit argument rather than reading `pokemonList` directly,
defaulting to the full list so existing call sites and tests are unaffected.
The win condition (`usedIds.size === pool.length`) is scoped to that same
pool, so a generation-restricted (and/or base-species-only) run can be won
without covering the whole national dex.

The menu's generation `<select>` and "include variants" checkbox are both
plain component state in `Game.tsx` (`selectedGeneration`, `includeVariants`),
the same "pre-game pick, not round logic" pattern as `view` — they're only
committed into the reducer, via the `SET_GENERATION` action, when Play starts
a genuinely fresh run (`streak === 0`). `SET_GENERATION` redraws the round
from the new pool, resets the streak, and adopts a caller-supplied
`bestStreak`, since only `Game.tsx` knows how to read the right
per-generation localStorage key; the reducer stays free of I/O. Both controls
are replaced by a "current run" summary (see above) whenever a run is in
progress (`streak > 0`), rather than merely disabled, since there's nothing
to pick until that run ends or is reset. `includeVariants` defaults to
`false` (unchecked): a fresh player's pool starts as base species only.

Best streaks are tracked per generation (not per `includeVariants` — that
toggle only affects which pool a run draws from, not which stats bucket it
counts against): `'all'` keeps the original plain `bestStreak` key (so
upgrading an existing save doesn't lose it), and every other generation gets
its own `bestStreak:gen<N>` key. The stats screen reads all of them into
`allBestStreaks` and renders one row per generation plus `'all'`, rather than
the single number it showed before this existed. The active run's generation
and `includeVariants` are restored from the `selectedGeneration` and
`includeVariants` keys — `HYDRATE_RUN` takes both as arguments, and they're
these same keys, since neither control is editable during a run (they're
replaced by the summary instead), guaranteeing they never diverge from the
active run's actual settings.

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
