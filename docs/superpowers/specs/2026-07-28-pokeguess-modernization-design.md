# Pokéguess modernization — design

**Date:** 2026-07-28
**Status:** Approved

## Problem

The project was last touched in November 2022 and no longer reflects a current
Next.js stack. It pins Next 13.0.3 (Pages Router), React 18.2, TypeScript 4.8,
antd 4, and styled-components 5. Both antd and styled-components have since had
breaking major releases, and the entire UI layer is being replaced regardless, so
an incremental dependency bump buys nothing.

The game logic also carries several defects (documented below) that are cheaper to
fix during the rewrite than to port forward deliberately.

## Goals

- Run on a current stack: Next 15 (App Router), React 19, TypeScript 5.
- Remove antd and styled-components entirely; style with Tailwind v4.
- Restructure the single 190-line `App.tsx` into small, composable components.
- Fix the known logic defects.
- Establish automated test coverage for the game logic.
- Give the game a committed visual identity.

## Non-goals

- Extending beyond dex 905. The sprite source
  (`github.com/rafavalerio/pokemon-sprites`) serves 001–905 and 404s above that;
  gen 9 would require sourcing sprites first.
- Dark mode. The design commits to a single light look.
- Any new gameplay feature (difficulty levels, timers, leaderboards, sharing).

## Stack

| Concern | From | To |
| --- | --- | --- |
| Framework | next 13.0.3, Pages Router | next 15.x, App Router |
| UI runtime | react 18.2.0 | react 19.x |
| Language | typescript 4.8.4 | typescript 5.x |
| Components | antd ^4.24.2 | none (hand-built) |
| Styling | styled-components ^5.3.6 | Tailwind v4 |
| Utilities | lodash ^4.17.21 | none (local helpers) |
| Testing | none | vitest + @testing-library/react + jsdom |

### Dependency removals

Dropped: `antd`, `@ant-design/icons`, `styled-components`,
`@types/styled-components`, `lodash`, `@types/lodash`.

`@ant-design/icons` is currently imported by `components/App.tsx` but absent from
`package.json` — it resolves only as a transitive dependency of antd. Removing
antd would break it either way.

`lodash` is used for exactly two functions, `random` and `shuffle`. Local
replacements that accept an injectable RNG make the game logic deterministic
under test, which a lodash dependency actively prevents.

### Configuration notes

- Tailwind v4 is CSS-first. There is no `tailwind.config.js`; design tokens are
  declared in an `@theme` block in `app/globals.css`.
- `next.config.js` replaces the deprecated `images.domains` with
  `images.remotePatterns` for `raw.githubusercontent.com`.
- Tailwind v4 requires Node 20+. The dev machine runs Node 22.16.0.

## Architecture

### File structure

```
app/
  layout.tsx              root layout, metadata, globals import
  page.tsx                server component; renders <Game/>
  globals.css             @import "tailwindcss" + @theme tokens
components/
  Game.tsx                'use client'; owns state, composes children
  PokedexShell.tsx        red chrome, lamp cluster, inner screen frame
  ScoreBoard.tsx          current streak and best streak
  PokemonSilhouette.tsx   sprite, reveal transition, loading indicator
  GuessGrid.tsx           2x2 option layout
  GuessButton.tsx         a single option
lib/
  game.ts                 pure game logic, no React
  pokemon.ts              name data and lookup
  formatDexNumber.ts      zero-pad to 3 digits
  game.test.ts            unit tests for lib/game.ts
```

### Deletions

| Path | Reason |
| --- | --- |
| `pages/` | Replaced by `app/` |
| `components/NoSSR.tsx` | Dead code; never imported |
| `pages/api/hello.ts` | create-next-app boilerplate, unused |
| `styles/globals.css` | Moves to `app/globals.css` |
| `public/vercel.svg` | Boilerplate, unused |
| `public/images/dot.png` | Tiled background replaced by the shell |

`public/images/pokeball.png` is retained as the loading indicator.

### Component responsibilities

Each component has one job and a narrow prop interface.

- **`Game`** — owns all state via the reducer below. Renders no styling of its
  own beyond composition. Consumes `lib/game.ts`.
- **`PokedexShell`** — presentational. Renders the red device chrome and lamp
  cluster, and frames `children` inside the neutral inner screen. Knows nothing
  about game state.
- **`ScoreBoard`** — props: `streak`, `bestStreak: number | null`. Renders `—`
  when `bestStreak` is null (pre-hydration).
- **`PokemonSilhouette`** — props: `dex`, `revealed`, `onReady`. Owns the image
  element and its load/error handling.
- **`GuessGrid`** — props: `options`, `state`, `onGuess`. Pure layout.
- **`GuessButton`** — props: `dex`, `state: 'idle' | 'correct' | 'wrong'`,
  `onClick`. A single `state` prop replaces the current nested ternary.

### State model

The present implementation holds six independent `useState` values
(`isHidden`, `randomPokemon`, `options`, `loading`, `streak`, `bestStreak`) that
can and do desynchronize. These collapse into one reducer:

```ts
type Status = 'loading' | 'guessing' | 'revealed'

type State = {
  status: Status
  dex: number
  options: number[]
  guess: number | null
  streak: number
  bestStreak: number | null
}
```

Actions:

| Action | Effect |
| --- | --- |
| `NEW_ROUND` | New `dex` and `options`; `status: 'loading'`; `guess: null` |
| `IMAGE_READY` | `status: 'loading' -> 'guessing'` |
| `GUESS` | Records `guess`; `status: 'revealed'`; updates streak and best streak |
| `NEXT` | Triggers `NEW_ROUND` |

`GuessButton`'s `state` prop derives from `status` and `guess`, so the dead
branch in the current render disappears by construction rather than by patch.

### Data flow

1. `Game` mounts; effect dispatches `NEW_ROUND` and reads `bestStreak` from
   `localStorage`.
2. `PokemonSilhouette` loads the sprite and calls `onReady`, dispatching
   `IMAGE_READY`.
3. The player clicks a `GuessButton`, dispatching `GUESS`. If correct, the new
   best streak is written to `localStorage` immediately.
4. `NEXT` returns to step 1.

## Defects fixed

1. **Best streak is lost on correct answers.** `components/App.tsx` only writes
   `bestStreak` inside the wrong-answer branch. A player on a 12-streak who
   closes the tab loses it. Fix: recompute `Math.max(streak + 1, bestStreak ?? 0)`
   and persist on every correct answer. The `?? 0` matters because `bestStreak` is
   `null` until the `localStorage` read completes.

2. **Loading state can hang on cached images.** `reset()` sets `loading = true`,
   and only the image's `onLoad` clears it. A cached sprite may not fire `onLoad`,
   leaving the spinner up permanently. Fix: check `ref.current.complete` on mount
   in addition to the `onLoad` handler, and handle `onError` so a failed sprite
   cannot strand the round.

3. **Dead conditional in the options render.** The inner
   `option === randomPokemon ? 'lime' : 'red'` sits inside a branch where that
   comparison is already known. Fix: eliminated by the `GuessButton` `state` prop.

4. **Best streak flashes 0 on first paint.** `localStorage` is read in an effect
   with no guard, so the server-rendered 0 is visible before hydration. Fix:
   `bestStreak` is `null` until read, and `ScoreBoard` renders `—` for null. This
   is what the unused `NoSSR.tsx` appears to have been an abandoned attempt at.

## Visual design

Direction C ("Pokédex device"), executed with restraint.

- The red device shell and its lamp cluster carry the visual identity.
- The inner screen is neutral and calm — close to a minimal layout — because that
  is the surface the player actually reads and interacts with.
- Correct/incorrect color appears **only inside the inner screen**, never on the
  shell. This keeps the shell's red from competing with the error state.
- Light mode only; no `prefers-color-scheme` handling.
- The silhouette remains hidden via `filter: brightness(0)` and reveals through a
  filter transition, as today.
- Layout must work at mobile widths; the 2x2 option grid and device frame both
  scale down rather than reflowing.

## Testing

`lib/game.ts` exposes pure functions taking an injectable RNG, making every
assertion deterministic.

Unit tests (`lib/game.test.ts`):

- `generateOptions` always includes the correct answer.
- `generateOptions` always returns exactly 4 entries.
- `generateOptions` never returns duplicates.
- All generated values fall within 1–905 inclusive.
- The streak reducer increments on a correct guess.
- The streak reducer resets to 0 on a wrong guess.
- `bestStreak` never decreases across any action sequence.
- `formatDexNumber` pads 1 to `001`, 10 to `010`, 100 to `100`, 905 to `905`.

Component test (React Testing Library):

- Rendering `Game`, clicking the correct option reveals the answer and the
  displayed streak reads 1.

Manual verification: boot the dev server and walk a full round in the browser to
confirm the redesign renders as intended at desktop and mobile widths.

## Risks

- This is a rewrite, not an incremental upgrade. There is no partially-migrated
  intermediate state to fall back to, so the work happens on a branch.
- The sprite host is a personal GitHub repo served through
  `raw.githubusercontent.com`. It responds correctly today (001 and 905 return
  200, 906 returns 404), but it is a single point of failure with no CDN
  guarantees. Out of scope to change here; worth noting.
