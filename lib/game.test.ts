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
