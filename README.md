# Pokéguess

Guess the Pokémon from its silhouette. Four options, one answer, and a streak
counter that remembers your best run.

## Running it

```bash
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
| `npm run lint` | ESLint |
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
Testing Library.

Two version pins are deliberate and should not be bumped casually:

- **TypeScript 6, not 7.** `typescript-eslint` throws on any TypeScript major
  `>= 7`, which makes `npm run lint` impossible to run.
- **ESLint 9, not 10.** Every plugin `eslint-config-next@16` bundles peers at
  `eslint ^9` or lower; under ESLint 10 the run crashes with
  `TypeError: scopeManager.addGlobals is not a function`.
