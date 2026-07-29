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

Sprites for dex 1–905 are served from
[rafavalerio/pokemon-sprites](https://github.com/rafavalerio/pokemon-sprites).

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
