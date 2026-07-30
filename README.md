# Pokéguess

Guess the Pokémon from its silhouette. Four options, one answer, and a streak
counter that remembers your best run.

## Running it

Requires **Node 22** (see `.nvmrc` and `engines` in `package.json`). Next 16
needs at least Node 20.9, and the deploy target is pinned to 22 so local and
production agree.

```bash
nvm use
npm install
npm run dev
```

Then open http://localhost:3000.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Lint with oxlint |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

## How it works

Game rules live in `lib/game.ts` as pure functions and a reducer, with the random
number generator injected so the tests are deterministic. `components/Game.tsx`
owns the reducer and composes the presentational components around it; those
components hold no game state of their own.

The first round is drawn during render, inside `useReducer`'s lazy
initializer — and that happens identically on the server and the client, so it
draws a different Pokémon in each place. Nothing derived from that draw is
rendered until after mount; `useSyncExternalStore` provides the SSR-safe
mounted flag that gates it, avoiding a hydration mismatch.

Sprites are served from the `official-artwork` folder of
[PokeAPI/sprites](https://github.com/PokeAPI/sprites). The full list — base
species plus Megas, regional forms, and Gigantamax forms — is generated from
PokeAPI's REST API by `scripts/build-pokemon-data.mjs` (`npm run
pokemon:build`) into `lib/pokemonData.ts`, checked in rather than fetched at
runtime.
The unrevealed sprite is the real image behind a `brightness-0` filter rather
than a second asset, so `PokemonSilhouette` also has to block the browser
affordances that would render the raw image and leak the answer — long-press
callout, drag preview, "open image in new tab".

There is no backend: no API routes, no database. The only persisted state is the
best streak in `localStorage`, written best-effort so the game still plays when
site data is blocked.

## Layout

```
app/           App Router entry, root layout, Tailwind theme in globals.css
components/    Game.tsx owns all state; the rest are presentational
lib/           Pure game logic, the generated Pokémon list and its lookup helpers
```

Colours and animations are Tailwind v4 `@theme` tokens in `app/globals.css`, and
`prefers-reduced-motion` is honoured globally there for every animation and
transition.

Type is [Onest](https://fonts.google.com/specimen/Onest), loaded as a variable
font through `next/font/google` — one file covering the whole 100–900 axis, of
which the UI uses 400/500/600/700. Hover and cursor affordances are gated on
`enabled:`, so revealed answers and loading skeletons stay inert, and Tailwind
v4 scopes `hover:` to `@media (hover: hover)` so none of it sticks on touch.

## Tests

`lib/game.test.ts` covers the reducer directly with scripted `rng` functions;
`components/Game.test.tsx` drives the rendered game with React Testing Library
and `user-event`. 24 tests, and they query by role and accessible name — so they
are also the guard on the game's accessibility semantics.

## Stack

Next 16 (App Router), React 19, TypeScript 6, Tailwind v4, Vitest and React
Testing Library. Linting is [oxlint](https://oxc.rs), configured in
`.oxlintrc.json`.

Every dependency is a caret range resolved by the lockfile, so `npm update`
moves the whole tree forward and `npm audit` reports zero advisories.

### Why oxlint and not ESLint

`eslint-config-next` pulls in `eslint-plugin-{react,import,jsx-a11y}`, and that
subtree dictated three separate version pins: TypeScript had to stay below 6.1
(`typescript-eslint` caps at `<6.1.0`), ESLint had to stay on 9 (the bundled
plugins crash under 10), and nine high-severity advisories sat permanently in
the tree via `minimatch@3 -> brace-expansion@1`, a line that has no patched
release — only `brace-expansion@5.0.8` is fixed.

oxlint is a single binary with no transitive dependencies. It ships all 21
`@next/eslint-plugin-next` rules plus the React, hooks, import and jsx-a11y
rules the old config provided, so nothing is lost, and it removed 284 packages
along with every advisory and every pin.

### The remaining constraints

- **`overrides` for `postcss` and `sharp`.** Next 16.2 depends on
  `postcss@8.4.31` exactly and on a `sharp` below 0.35, both of which carry
  high-severity advisories. The overrides are what keeps `npm audit` clean;
  removing them brings back three advisories. They can go once Next ships a
  release that bumps both.
- **jsdom 29, not 30.** jsdom 30 requires Node `^22.22.2`. The `^29.1.1` range
  caps itself, so it will not jump until the range is widened — do that after
  moving local and CI Node to 22.22.2 or newer.
- **TypeScript 6, not 7.** TypeScript 7 type-checks this project cleanly, but
  Next 16.2 rejects its compiler API unless `experimental.useTypeScriptCli` is
  enabled. Worth revisiting when that flag graduates.

**Do not run `npm audit fix --force`.** Its suggested fix is still to downgrade
`next` to 9.3.3.
