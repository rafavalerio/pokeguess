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
