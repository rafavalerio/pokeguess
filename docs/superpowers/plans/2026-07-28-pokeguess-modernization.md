# Pokéguess Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Pokéguess game on Next 16 (App Router), React 19, TypeScript 6 and Tailwind v4, removing antd, styled-components and lodash, fixing four known defects, and adding automated test coverage.

**Architecture:** All game rules live in `lib/game.ts` as pure functions plus a reducer, with the random number generator injected so tests are deterministic. React components are thin: `Game` owns the reducer and composes five presentational components that receive props and render. Styling is Tailwind utility classes with design tokens declared in an `@theme` block; no CSS-in-JS runtime.

**Tech Stack:** next 16.2.12, react 19.2.8, typescript 6.0.3, tailwindcss 4.3.3, lucide-react 1.27.0, vitest 4.1.10, @testing-library/react 16.3.2, jsdom 30.0.0, eslint 9.39.5

## Global Constraints

- Dex range is **1–905 inclusive**. The sprite host serves `001`–`905`; `906` returns 404.
- Sprite URL base: `https://raw.githubusercontent.com/rafavalerio/pokemon-sprites/master/images` — filename is the dex number zero-padded to 3 digits, `.png`.
- **Light mode only.** No `prefers-color-scheme` handling, no `dark:` variants.
- Correct/incorrect color appears **only inside the inner screen**, never on the red shell.
- No antd, no styled-components, no lodash, and no `@ant-design/icons` anywhere in the final tree.
- Icons come from `lucide-react`, imported individually. Decorative icons carry `aria-hidden="true"`.
- Node 20+ required (dev machine runs 22.16.0).
- All work happens on branch `modernize-tailwind-next15`.
- Package manager is **npm** (the repo has `yarn.lock`, which Task 1 removes in favour of `package-lock.json`).
- Every task ends with a commit.

---

### Task 1: Dependency reset and toolchain config

Replaces the entire dependency tree and build configuration in one move. This is a single task because the app does not compile at any intermediate point — a half-swapped `package.json` is not independently reviewable.

**Files:**
- Modify: `package.json` (full rewrite)
- Create: `eslint.config.mjs`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `next.config.js` → rename to `next.config.mjs`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Delete: `.eslintrc.json`, `yarn.lock`

**Interfaces:**
- Consumes: nothing
- Produces: working `npm run dev`, `npm run build`, `npm run lint`, `npm test` scripts. All later tasks rely on `npm test` running Vitest with jsdom and `@testing-library/jest-dom` matchers pre-loaded.

- [ ] **Step 1: Delete the obsolete config and lockfile**

```bash
git rm -f .eslintrc.json yarn.lock
```

- [ ] **Step 2: Write the new `package.json`**

Note `next lint` is gone in Next 16 — `lint` calls `eslint` directly.

```json
{
  "name": "pokeguess",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "lucide-react": "1.27.0",
    "next": "16.2.12",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.3.3",
    "@testing-library/jest-dom": "7.0.0",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "26.1.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.4",
    "eslint": "9.39.5",
    "eslint-config-next": "16.2.12",
    "jsdom": "30.0.0",
    "tailwindcss": "4.3.3",
    "typescript": "6.0.3",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 3: Write `eslint.config.mjs`**

ESLint 9 is flat-config capable and is what `eslint-config-next@16` actually
supports — every plugin it bundles declares peer `eslint ... || ^9` and none
accept ESLint 10, which crashes with `scopeManager.addGlobals is not a function`.
`eslint-config-next/core-web-vitals` exports a `Linter.Config[]` array, so spread
it. Assign to a named const before exporting, or `import/no-anonymous-default-export`
warns.

```js
import next from 'eslint-config-next/core-web-vitals'

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
]

export default config
```

- [ ] **Step 4: Write `postcss.config.mjs`**

Tailwind v4 moved its PostCSS plugin into a separate package.

```js
const config = {
  plugins: { '@tailwindcss/postcss': {} },
}

export default config
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 6: Write `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 7: Replace `next.config.js` with `next.config.mjs`**

`images.domains` was removed; `remotePatterns` replaces it. The file must be `.mjs` because `package.json` now sets `"type": "module"`.

```bash
git rm -f next.config.js
```

Then create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/rafavalerio/pokemon-sprites/**',
      },
    ],
  },
}

export default nextConfig
```

`swcMinify` is dropped — it has been the default and a no-op option since Next 15.

- [ ] **Step 8: Rewrite `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "verbatimModuleSyntax": true,
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 9: Add `.gitignore` entries**

Append these lines if not already present:

```
/coverage
*.tsbuildinfo
```

- [ ] **Step 10: Install and verify the toolchain**

```bash
npm install
```

Expected: completes with no peer-dependency errors.

```bash
npx tsc --noEmit || true
```

Expected: **FAIL**, and that is correct at this point. The old `pages/` and
`components/` still import antd and styled-components, which are no longer
installed. Task 3 deletes those files. Record the error list in your report and
move on — do not attempt to fix them in this task, and do not reinstall the
removed packages to make the check pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: replace toolchain with Next 16, React 19, TS 7, Tailwind v4, Vitest"
```

---

### Task 2: Pure game logic with tests

The heart of the rewrite. Written first and test-driven, because every later task consumes it.

**Files:**
- Create: `lib/formatDexNumber.ts`
- Create: `lib/game.ts`
- Create: `lib/game.test.ts`
- Create: `lib/pokemon.ts`
- Delete: `utils/formatPokemonNumber.ts`, `utils/pokemonNames.ts`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces:
  - `formatDexNumber(dex: number): string` — zero-pads to 3 chars
  - `pokemonNames: readonly string[]` — 905 entries, index = dex − 1
  - `getPokemonName(dex: number): string`
  - `MIN_DEX = 1`, `MAX_DEX = 905`
  - `type Rng = () => number`
  - `randomDex(rng: Rng): number`
  - `generateOptions(answer: number, rng: Rng): number[]`
  - `type Status = 'loading' | 'guessing' | 'revealed'`
  - `type GameState`, `type GameAction`
  - `createInitialState(rng: Rng): GameState`
  - `gameReducer(state: GameState, action: GameAction): GameState`

- [ ] **Step 1: Move the name data**

`utils/pokemonNames.ts` already contains the 905-entry array. Move it and add a lookup, preserving the array contents exactly.

```bash
git mv utils/pokemonNames.ts lib/pokemon.ts
```

Then change the first line of `lib/pokemon.ts` from:

```ts
export const pokemonNames = [
```

to:

```ts
export const pokemonNames: readonly string[] = [
```

and append at the end of the file:

```ts
export const getPokemonName = (dex: number): string =>
  pokemonNames[dex - 1] ?? 'Unknown'
```

- [ ] **Step 2: Write the failing tests for `formatDexNumber` and `generateOptions`**

Create `lib/game.test.ts`. `makeRng` returns a deterministic generator that cycles through fixed values, so no test depends on chance.

```ts
import { describe, expect, it } from 'vitest'

import formatDexNumber from './formatDexNumber'
import {
  MAX_DEX,
  MIN_DEX,
  createInitialState,
  gameReducer,
  generateOptions,
  randomDex,
  type Rng,
} from './game'

const makeRng = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('formatDexNumber', () => {
  it('pads to three digits', () => {
    expect(formatDexNumber(1)).toBe('001')
    expect(formatDexNumber(10)).toBe('010')
    expect(formatDexNumber(100)).toBe('100')
    expect(formatDexNumber(905)).toBe('905')
  })
})

describe('randomDex', () => {
  it('maps 0 to MIN_DEX and just under 1 to MAX_DEX', () => {
    expect(randomDex(() => 0)).toBe(MIN_DEX)
    expect(randomDex(() => 0.999999)).toBe(MAX_DEX)
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

  it('keeps every option within the dex range', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const option of generateOptions(42, makeRng([seed / 50]))) {
        expect(option).toBeGreaterThanOrEqual(MIN_DEX)
        expect(option).toBeLessThanOrEqual(MAX_DEX)
      }
    }
  })

  it('makes progress even when the rng keeps returning the answer', () => {
    const answerDraw = (42 - MIN_DEX) / (MAX_DEX - MIN_DEX + 1)
    expect(generateOptions(42, makeRng([answerDraw, 0.5, 0.6, 0.7]))).toHaveLength(4)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './formatDexNumber'` and `'./game'`.

- [ ] **Step 4: Write `lib/formatDexNumber.ts`**

The old `utils/formatPokemonNumber.ts` returned `string | number`, which forced callers to handle both. This returns `string` always.

```ts
const formatDexNumber = (dex: number): string => String(dex).padStart(3, '0')

export default formatDexNumber
```

Then remove the superseded file:

```bash
git rm -f utils/formatPokemonNumber.ts
```

- [ ] **Step 5: Write the generation half of `lib/game.ts`**

```ts
export const MIN_DEX = 1
export const MAX_DEX = 905

export type Rng = () => number

export const randomDex = (rng: Rng): number =>
  MIN_DEX + Math.floor(rng() * (MAX_DEX - MIN_DEX + 1))

const shuffle = <T,>(items: T[], rng: Rng): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export const generateOptions = (answer: number, rng: Rng): number[] => {
  const options = new Set<number>([answer])
  let guard = 0
  while (options.size < 4 && guard < 1000) {
    options.add(randomDex(rng))
    guard += 1
  }
  return shuffle([...options], rng)
}
```

`shuffle` is declared before `generateOptions` because ESLint's
`no-use-before-define` flags the reverse order for `const` arrow functions. The
trailing comma in `<T,>` is required — in a `.ts` file `<T>` alone parses fine,
but keeping the comma means the code survives being moved into a `.tsx` file.

The `guard` counter exists because an rng that repeatedly returns the answer would otherwise spin forever. The `Set` gives uniqueness for free — the old `options.includes` loop did the same job more slowly.

- [ ] **Step 6: Run the tests to verify the generation tests pass**

Run: `npm test`
Expected: `formatDexNumber`, `randomDex` and `generateOptions` blocks PASS. The reducer tests still FAIL — `createInitialState` and `gameReducer` are not exported yet.

- [ ] **Step 7: Write the failing reducer tests**

Append to `lib/game.test.ts`:

```ts
describe('gameReducer', () => {
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
    state = gameReducer(state, { type: 'GUESS', dex: state.dex })
    expect(state.status).toBe('revealed')
    expect(state.streak).toBe(1)
  })

  it('resets the streak to zero on a wrong guess', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', dex: state.dex })
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    const wrong = state.options.find((o) => o !== state.dex)!
    state = gameReducer(state, { type: 'GUESS', dex: wrong })
    expect(state.streak).toBe(0)
  })

  it('records the best streak on a correct guess, not only on a wrong one', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', dex: state.dex })
    expect(state.bestStreak).toBe(1)
  })

  it('never lets the best streak decrease', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', dex: state.dex })
    const peak = state.bestStreak
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    const wrong = state.options.find((o) => o !== state.dex)!
    state = gameReducer(state, { type: 'GUESS', dex: wrong })
    expect(state.bestStreak).toBe(peak)
  })

  it('ignores a guess that arrives when not in the guessing status', () => {
    const state = start()
    expect(gameReducer(state, { type: 'GUESS', dex: state.dex })).toBe(state)
  })

  it('adopts a stored best streak only when it beats the current one', () => {
    let state = gameReducer(start(), { type: 'HYDRATE_BEST', bestStreak: 9 })
    expect(state.bestStreak).toBe(9)
    state = gameReducer(state, { type: 'HYDRATE_BEST', bestStreak: 3 })
    expect(state.bestStreak).toBe(9)
  })

  it('returns to loading with a fresh pokemon on NEXT', () => {
    let state = gameReducer(start(), { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', dex: state.dex })
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.77]) })
    expect(state.status).toBe('loading')
    expect(state.guess).toBeNull()
    expect(state.options).toHaveLength(4)
  })
})
```

- [ ] **Step 8: Run the tests to verify the reducer tests fail**

Run: `npm test`
Expected: FAIL — `createInitialState is not a function`.

- [ ] **Step 9: Write the reducer half of `lib/game.ts`**

Append to `lib/game.ts`:

```ts
export type Status = 'loading' | 'guessing' | 'revealed'

export type GameState = {
  status: Status
  dex: number
  options: number[]
  guess: number | null
  streak: number
  bestStreak: number | null
}

export type GameAction =
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; dex: number }
  | { type: 'NEXT'; rng: Rng }
  | { type: 'HYDRATE_BEST'; bestStreak: number }

const startRound = (rng: Rng): Pick<GameState, 'status' | 'dex' | 'options' | 'guess'> => {
  const dex = randomDex(rng)
  return { status: 'loading', dex, options: generateOptions(dex, rng), guess: null }
}

export const createInitialState = (rng: Rng): GameState => ({
  ...startRound(rng),
  streak: 0,
  bestStreak: null,
})

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'IMAGE_READY':
      return state.status === 'loading' ? { ...state, status: 'guessing' } : state

    case 'GUESS': {
      if (state.status !== 'guessing') return state
      const correct = action.dex === state.dex
      const streak = correct ? state.streak + 1 : 0
      return {
        ...state,
        status: 'revealed',
        guess: action.dex,
        streak,
        bestStreak: Math.max(streak, state.bestStreak ?? 0),
      }
    }

    case 'NEXT':
      return { ...state, ...startRound(action.rng) }

    case 'HYDRATE_BEST':
      return { ...state, bestStreak: Math.max(action.bestStreak, state.bestStreak ?? 0) }

    default:
      return state
  }
}
```

`bestStreak` is recomputed on *every* `GUESS`, which is defect 1. Guarding `GUESS` on `status === 'guessing'` prevents double-scoring from a double click.

- [ ] **Step 10: Run the full suite**

Run: `npm test`
Expected: PASS — all tests green.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add pure game logic with deterministic tests"
```

---

### Task 3: App Router shell and Tailwind theme

Stands up `app/` and the stylesheet so the tree compiles without any of the deleted libraries. Produces a running page before any game component exists.

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Delete: `pages/index.tsx`, `pages/_app.tsx`, `pages/api/hello.ts`, `styles/globals.css`, `components/NoSSR.tsx`, `components/App.tsx`, `components/PokemonImage.tsx`, `public/vercel.svg`, `public/images/dot.png`

**Interfaces:**
- Consumes: nothing
- Produces: Tailwind theme tokens usable as utility classes in Tasks 4–5 — `bg-shell`, `bg-screen`, `bg-screen-sunk`, `text-ink`, `text-ink-soft`, `border-shell-edge`, `bg-correct`, `text-correct-ink`, `bg-wrong`, `text-wrong-ink`. Also `app/page.tsx` rendering `<Game />` from `@/components/Game`.

- [ ] **Step 1: Delete the Pages Router tree and dead files**

```bash
git rm -rf pages styles components public/vercel.svg public/images/dot.png
```

`components/` is removed wholesale — `App.tsx`, `PokemonImage.tsx` and the never-imported `NoSSR.tsx` are all superseded. `public/images/pokeball.png` survives because it sits outside the removed paths.

- [ ] **Step 2: Verify the retained asset survived**

```bash
ls public/images/
```

Expected: `pokeball.png`

- [ ] **Step 3: Write `app/globals.css`**

Tailwind v4 is CSS-first: `@theme` declarations become utility classes automatically. There is no `tailwind.config.js`.

```css
@import 'tailwindcss';

@theme {
  --color-shell: #d13b32;
  --color-shell-dark: #a32d26;
  --color-shell-edge: #e8837c;

  --color-screen: #f7f4ee;
  --color-screen-sunk: #e9e4d9;
  --color-button: #ffffff;

  --color-ink: #2c2c2a;
  --color-ink-soft: #6f6d66;

  --color-correct: #dff0c8;
  --color-correct-ink: #2f5b12;
  --color-wrong: #f8d7d7;
  --color-wrong-ink: #8c2020;

  --color-lamp-blue: #6fb2e8;
  --color-lamp-amber: #f0b23c;
  --color-lamp-green: #7fc45a;
}

html,
body {
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 4: Write `app/layout.tsx`**

App Router uses the `metadata` export instead of `next/head`.

```tsx
import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Pokéguess',
  description: "Guess the Pokémon from its silhouette.",
  icons: { icon: '/favicon.ico' },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body className="bg-shell-dark min-h-screen">{children}</body>
  </html>
)

export default RootLayout
```

- [ ] **Step 5: Write `app/page.tsx`**

A server component; only `Game` opts into the client.

```tsx
import Game from '@/components/Game'

const Home = () => (
  <main className="flex min-h-screen items-center justify-center p-4">
    <Game />
  </main>
)

export default Home
```

- [ ] **Step 6: Create a placeholder `components/Game.tsx` so the build compiles**

Task 5 replaces this entirely. It exists only so this task is independently verifiable.

```tsx
const Game = () => <div className="bg-screen rounded-xl p-8">Game goes here</div>

export default Game
```

- [ ] **Step 7: Verify the build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three PASS. There must be no remaining reference to antd, styled-components or lodash.

- [ ] **Step 8: Prove the old libraries are gone from source**

```bash
grep -rE "antd|styled-components|lodash" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.mjs" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=docs
```

Expected: no output (exit code 1).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: migrate to App Router with Tailwind v4 theme"
```

---

### Task 4: Presentational components

Five components, each with one job and no game state. Built together because they share the design tokens and are only meaningful assembled.

**Files:**
- Create: `components/PokedexShell.tsx`
- Create: `components/ScoreBoard.tsx`
- Create: `components/PokemonSilhouette.tsx`
- Create: `components/GuessButton.tsx`
- Create: `components/GuessGrid.tsx`

**Interfaces:**
- Consumes: `formatDexNumber` and `getPokemonName` from Task 2; theme tokens from Task 3
- Produces:
  - `<PokedexShell>{children}</PokedexShell>`
  - `<ScoreBoard streak={number} bestStreak={number | null} />`
  - `<PokemonSilhouette dex={number} revealed={boolean} onReady={() => void} />`
  - `type GuessState = 'idle' | 'correct' | 'wrong'`
  - `<GuessButton dex={number} state={GuessState} disabled={boolean} onClick={() => void} />`
  - `<GuessGrid options={number[]} answer={number} guess={number | null} revealed={boolean} onGuess={(dex: number) => void} />`

- [ ] **Step 1: Write `components/PokedexShell.tsx`**

Pure chrome. It never sees game state, which is what keeps win/loss colour off the red shell.

```tsx
const Lamp = ({ className }: { className: string }) => (
  <span className={`rounded-full ${className}`} aria-hidden="true" />
)

const PokedexShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-shell border-shell-edge w-full max-w-md rounded-2xl border-4 p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <Lamp className="bg-lamp-blue border-screen size-7 border-2" />
      <Lamp className="bg-lamp-amber size-3" />
      <Lamp className="bg-lamp-green size-3" />
    </div>
    <div className="bg-screen rounded-xl p-4 sm:p-5">{children}</div>
  </div>
)

export default PokedexShell
```

- [ ] **Step 2: Write `components/ScoreBoard.tsx`**

Rendering `—` while `bestStreak` is `null` is defect 4 — it avoids the server-rendered `0` flashing before hydration.

```tsx
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="text-ink-soft text-xs">{label}</span>
    <span className="text-ink text-sm font-medium" data-testid={`stat-${label.toLowerCase()}`}>
      {value}
    </span>
  </div>
)

type Props = {
  streak: number
  bestStreak: number | null
}

const ScoreBoard = ({ streak, bestStreak }: Props) => (
  <div className="flex items-center justify-center gap-5">
    <Stat label="Streak" value={String(streak)} />
    <Stat label="Best" value={bestStreak === null ? '—' : String(bestStreak)} />
  </div>
)

export default ScoreBoard
```

The `data-testid` on the value exists because Task 5 asserts on the streak. After
one correct guess both Streak and Best read `1`, so a bare `getByText('1')` would
match two elements and throw.

- [ ] **Step 3: Write `components/PokemonSilhouette.tsx`**

This is defect 2. `onLoad` alone misses images the browser already has cached; the effect checks `complete` on mount to cover that, and `onError` stops a dead sprite stranding the round.

```tsx
'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

import formatDexNumber from '@/lib/formatDexNumber'
import { getPokemonName } from '@/lib/pokemon'

const SPRITE_BASE =
  'https://raw.githubusercontent.com/rafavalerio/pokemon-sprites/master/images'

type Props = {
  dex: number
  revealed: boolean
  onReady: () => void
}

const PokemonSilhouette = ({ dex, revealed, onReady }: Props) => {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (ref.current?.complete) onReady()
  }, [dex, onReady])

  return (
    <div className="bg-screen-sunk mx-auto flex size-48 items-center justify-center rounded-full sm:size-56">
      <Image
        ref={ref}
        key={dex}
        src={`${SPRITE_BASE}/${formatDexNumber(dex)}.png`}
        alt={
          revealed
            ? `${getPokemonName(dex)}, number ${dex}`
            : 'Hidden Pokémon silhouette'
        }
        width={192}
        height={192}
        priority
        draggable={false}
        onLoad={onReady}
        onError={onReady}
        className={`size-40 select-none transition-[filter] duration-300 sm:size-48 ${
          revealed ? 'brightness-100' : 'brightness-0'
        }`}
      />
    </div>
  )
}

export default PokemonSilhouette
```

`key={dex}` forces a fresh element per round so `complete` is re-evaluated rather than reused.

- [ ] **Step 4: Write `components/GuessButton.tsx`**

The single `state` prop is defect 3 — the old nested ternary cannot be reconstructed here.

```tsx
import { Check, X } from 'lucide-react'

import { getPokemonName } from '@/lib/pokemon'

export type GuessState = 'idle' | 'correct' | 'wrong'

const styles: Record<GuessState, string> = {
  idle: 'bg-button text-ink border-screen-sunk hover:border-shell hover:bg-screen-sunk',
  correct: 'bg-correct text-correct-ink border-correct',
  wrong: 'bg-wrong text-wrong-ink border-wrong',
}

type Props = {
  dex: number
  state: GuessState
  disabled: boolean
  onClick: () => void
}

const GuessButton = ({ dex, state, disabled, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`focus-visible:ring-shell flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default ${styles[state]}`}
  >
    {state === 'correct' && <Check className="size-4 shrink-0" aria-hidden="true" />}
    {state === 'wrong' && <X className="size-4 shrink-0" aria-hidden="true" />}
    <span className="truncate">{getPokemonName(dex)}</span>
  </button>
)

export default GuessButton
```

- [ ] **Step 5: Write `components/GuessGrid.tsx`**

Only the guessed wrong option is marked wrong — unpicked wrong options stay idle, so the board does not turn into a wall of red.

```tsx
import GuessButton, { type GuessState } from './GuessButton'

type Props = {
  options: number[]
  answer: number
  guess: number | null
  revealed: boolean
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

const GuessGrid = ({ options, answer, guess, revealed, onGuess }: Props) => (
  <div className="grid grid-cols-2 gap-2">
    {options.map((dex) => (
      <GuessButton
        key={dex}
        dex={dex}
        state={stateFor(dex, answer, guess, revealed)}
        disabled={revealed}
        onClick={() => onGuess(dex)}
      />
    ))}
  </div>
)

export default GuessGrid
```

- [ ] **Step 6: Verify types and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add presentational Pokedex components"
```

---

### Task 5: Wire up the Game component

Replaces the Task 3 placeholder with the real thing and proves the whole stack works end to end.

**Files:**
- Modify: `components/Game.tsx` (full rewrite)
- Create: `components/Game.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2 and 4
- Produces: the finished app

- [ ] **Step 1: Write the failing component test**

`Math.random` is stubbed so the round is deterministic, and `localStorage` is cleared so best-streak assertions do not leak between tests.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Game from './Game'
import { getPokemonName } from '@/lib/pokemon'

vi.mock('next/image', async () => {
  const { useEffect } = await import('react')
  return {
    default: ({ onLoad, alt }: { onLoad?: () => void; alt: string }) => {
      useEffect(() => {
        onLoad?.()
      }, [onLoad])
      return <img alt={alt} />
    },
  }
})

describe('Game', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reveals the answer and scores a streak of 1 on a correct guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const answerName = getPokemonName(453)
    await user.click(screen.getByRole('button', { name: answerName }))

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('persists the best streak to localStorage on a correct guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: getPokemonName(453) }))

    expect(localStorage.getItem('bestStreak')).toBe('1')
  })
})
```

With `Math.random` fixed at `0.5`, `randomDex` yields `1 + floor(0.5 * 905) = 453`. If that number proves wrong when the test runs, read the actual dex from the rendered output and correct the constant — do not change the reducer to match.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — the placeholder `Game` renders no buttons.

- [ ] **Step 3: Write the real `components/Game.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useReducer } from 'react'

import GuessGrid from './GuessGrid'
import PokedexShell from './PokedexShell'
import PokemonSilhouette from './PokemonSilhouette'
import ScoreBoard from './ScoreBoard'
import { createInitialState, gameReducer, type Rng } from '@/lib/game'
import { getPokemonName } from '@/lib/pokemon'

const BEST_STREAK_KEY = 'bestStreak'
const rng: Rng = () => Math.random()

const Game = () => {
  const [state, dispatch] = useReducer(gameReducer, rng, createInitialState)

  useEffect(() => {
    const stored = Number(localStorage.getItem(BEST_STREAK_KEY))
    if (Number.isFinite(stored) && stored > 0) {
      dispatch({ type: 'HYDRATE_BEST', bestStreak: stored })
    }
  }, [])

  useEffect(() => {
    if (state.bestStreak !== null) {
      localStorage.setItem(BEST_STREAK_KEY, String(state.bestStreak))
    }
  }, [state.bestStreak])

  const handleReady = useCallback(() => dispatch({ type: 'IMAGE_READY' }), [])
  const revealed = state.status === 'revealed'

  return (
    <PokedexShell>
      <h1 className="text-ink mb-1 text-center text-lg font-medium">Pokéguess</h1>
      <p className="text-ink-soft mb-3 text-center text-xs">Who&apos;s that Pokémon?</p>

      <div className="mb-4">
        <ScoreBoard streak={state.streak} bestStreak={state.bestStreak} />
      </div>

      <div className="mb-3">
        <PokemonSilhouette dex={state.dex} revealed={revealed} onReady={handleReady} />
      </div>

      <p className="text-ink mb-4 h-6 text-center text-sm font-medium">
        {revealed ? `#${state.dex} · ${getPokemonName(state.dex)}` : ' '}
      </p>

      <GuessGrid
        options={state.options}
        answer={state.dex}
        guess={state.guess}
        revealed={revealed}
        onGuess={(dex) => dispatch({ type: 'GUESS', dex })}
      />

      <button
        type="button"
        onClick={() => dispatch({ type: 'NEXT', rng })}
        disabled={!revealed}
        className="bg-shell focus-visible:ring-shell mt-4 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
      >
        Next
      </button>
    </PokedexShell>
  )
}

export default Game
```

The name label reserves its height with `h-6` and a non-breaking space so revealing the answer does not shift the layout. The old build blurred a permanently-visible name; here it is simply absent until revealed, which cannot be defeated by disabling CSS.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS — all logic and component tests green.

- [ ] **Step 5: Verify the production build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all three PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire up Game with reducer state and streak persistence"
```

---

### Task 6: Browser verification and README

Confirms the redesign renders correctly at both widths and refreshes the stale create-next-app README.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished app
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Start the dev server**

Use the preview tooling rather than a raw `npm run dev` in a shell, so the browser can drive it.

Expected: server reachable at `http://localhost:3000`.

- [ ] **Step 2: Verify a full round at desktop width**

Load the page at 1280×800 and check, by reading the page and taking a screenshot:
- The red shell, lamp cluster and inner screen render as designed.
- The silhouette is fully blacked out, and the name label is empty.
- Best reads `—` on a first visit with empty `localStorage`.
- Clicking the correct option turns exactly one button green with a check, reveals the name, and sets Streak to 1.
- Clicking a wrong option turns that button red with an X and the correct one green, and resets Streak to 0.
- `Next` is disabled before a guess and enabled after.

- [ ] **Step 3: Verify at mobile width**

Resize to 375×812 and confirm the shell, the 2×2 grid and the silhouette all scale down without horizontal overflow or clipped button text.

- [ ] **Step 4: Verify best-streak persistence across reload**

Build a streak of 2, reload the page, and confirm Best still reads 2 and does not flash `0` during load.

- [ ] **Step 5: Check the browser console**

Expected: no errors and no React hydration warnings.

- [ ] **Step 6: Rewrite `README.md`**

```markdown
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
owns the reducer and composes the presentational components around it. Sprites
for dex 1–905 are served from
[rafavalerio/pokemon-sprites](https://github.com/rafavalerio/pokemon-sprites).

## Stack

Next 16 (App Router), React 19, TypeScript 6, Tailwind v4, Vitest and React
Testing Library.
```

- [ ] **Step 7: Final full verification**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: rewrite README for the modernized stack"
```

---

## Verification Summary

The work is done when all of the following hold:

- `npm test` passes — 8 logic tests, 9 reducer tests, 2 component tests.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` succeeds.
- The `grep` in Task 3 Step 8 returns nothing for antd, styled-components and lodash.
- The browser walkthrough in Task 6 succeeds at 1280×800 and 375×812 with a clean console.
- All four defects from the spec are fixed: best streak persists on correct answers (Task 2 Step 9), cached images cannot hang the loader (Task 4 Step 3), the dead ternary is gone (Task 4 Step 4), and the best streak does not flash `0` (Task 4 Step 2).
