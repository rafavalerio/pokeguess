import { describe, expect, it } from 'vitest'

import { pokemonPoolFor } from './generations'
import { TIME_TRIAL_ROUND_COUNT } from './gameConfig'
import {
  createInitialTimeTrialState,
  formatElapsedMs,
  isBetterTimeTrialResult,
  timeTrialReducer,
  type Rng,
} from './timeTrial'

const makeRng = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

// A constant rng makes randomPokemonExcluding's guard trip every time after
// the first draw, falling back to its deterministic "first still-unused
// entry" behavior — see lib/game.ts. That's fine here: these tests only
// assert structural properties (10 unique rounds, each with 4 options
// including its own answer), not which specific Pokémon get drawn.
const rng = makeRng([0.37])

describe('createInitialTimeTrialState', () => {
  it('draws exactly TIME_TRIAL_ROUND_COUNT unique rounds and starts in "preparing"', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)

    expect(state.status).toBe('preparing')
    expect(state.rounds).toHaveLength(TIME_TRIAL_ROUND_COUNT)
    expect(new Set(state.rounds.map((round) => round.pokemonId)).size).toBe(TIME_TRIAL_ROUND_COUNT)
    expect(state.startedAt).toBeNull()
    expect(state.finishedAt).toBeNull()
    expect(state.results).toEqual([])
    expect(state.roundIndex).toBe(0)
  })

  it('gives every round exactly 4 options that include that round\'s own answer', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)

    for (const round of state.rounds) {
      expect(round.options).toHaveLength(4)
      expect(new Set(round.options).size).toBe(4)
      expect(round.options).toContain(round.pokemonId)
    }
  })

  it('draws only from the given generation/includeVariants pool', () => {
    const pool = pokemonPoolFor(1, false)
    const poolIds = new Set(pool.map((entry) => entry.id))
    const state = createInitialTimeTrialState(rng, 1, false)

    for (const round of state.rounds) {
      expect(poolIds.has(round.pokemonId)).toBe(true)
    }
  })
})

describe('timeTrialReducer', () => {
  it('runs a full flawless trial from PRELOADED to finished', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)

    state = timeTrialReducer(state, { type: 'PRELOADED', now: 1000 })
    expect(state.status).toBe('loading')
    expect(state.startedAt).toBe(1000)

    for (let i = 0; i < TIME_TRIAL_ROUND_COUNT; i += 1) {
      state = timeTrialReducer(state, { type: 'IMAGE_READY' })
      expect(state.status).toBe('guessing')

      const round = state.rounds[state.roundIndex]
      const now = 1000 + (i + 1) * 500
      state = timeTrialReducer(state, { type: 'GUESS', pokemonId: round.pokemonId, now })
      expect(state.status).toBe('revealed')
      expect(state.results[i]).toEqual({ pokemonId: round.pokemonId, guess: round.pokemonId, correct: true })

      state = timeTrialReducer(state, { type: 'ADVANCE' })
      if (i < TIME_TRIAL_ROUND_COUNT - 1) {
        // oxlint-disable-next-line vitest/no-conditional-expect
        expect(state.status).toBe('loading')
        // oxlint-disable-next-line vitest/no-conditional-expect
        expect(state.roundIndex).toBe(i + 1)
      }
    }

    expect(state.status).toBe('finished')
    expect(state.finishedAt).toBe(1000 + TIME_TRIAL_ROUND_COUNT * 500)
    expect(state.results).toHaveLength(TIME_TRIAL_ROUND_COUNT)
    expect(state.results.every((result) => result.correct)).toBe(true)
  })

  it('records a wrong guess without ending the trial early', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)
    state = timeTrialReducer(state, { type: 'PRELOADED', now: 0 })
    state = timeTrialReducer(state, { type: 'IMAGE_READY' })

    const round = state.rounds[0]
    const wrongId = round.options.find((id) => id !== round.pokemonId)!
    state = timeTrialReducer(state, { type: 'GUESS', pokemonId: wrongId, now: 100 })

    expect(state.status).toBe('revealed')
    expect(state.results[0]).toEqual({ pokemonId: round.pokemonId, guess: wrongId, correct: false })

    state = timeTrialReducer(state, { type: 'ADVANCE' })
    expect(state.status).toBe('loading')
    expect(state.roundIndex).toBe(1)
  })

  it('sets finishedAt on the last round\'s GUESS, not on the ADVANCE that follows it', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)
    state = timeTrialReducer(state, { type: 'PRELOADED', now: 0 })
    for (let i = 0; i < TIME_TRIAL_ROUND_COUNT - 1; i += 1) {
      state = timeTrialReducer(state, { type: 'IMAGE_READY' })
      state = timeTrialReducer(state, {
        type: 'GUESS',
        pokemonId: state.rounds[state.roundIndex].pokemonId,
        now: i,
      })
      state = timeTrialReducer(state, { type: 'ADVANCE' })
    }
    state = timeTrialReducer(state, { type: 'IMAGE_READY' })
    expect(state.finishedAt).toBeNull()

    state = timeTrialReducer(state, {
      type: 'GUESS',
      pokemonId: state.rounds[state.roundIndex].pokemonId,
      now: 9999,
    })
    expect(state.status).toBe('revealed')
    expect(state.finishedAt).toBe(9999)

    state = timeTrialReducer(state, { type: 'ADVANCE' })
    expect(state.status).toBe('finished')
    expect(state.finishedAt).toBe(9999)
  })

  it('ignores GUESS when not in the guessing status', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)
    const result = timeTrialReducer(state, {
      type: 'GUESS',
      pokemonId: state.rounds[0].pokemonId,
      now: 0,
    })
    expect(result).toBe(state)
  })

  it('ignores ADVANCE when not in the revealed status', () => {
    const state = createInitialTimeTrialState(rng, 'all', false)
    const result = timeTrialReducer(state, { type: 'ADVANCE' })
    expect(result).toBe(state)
  })

  it('START draws a completely fresh trial regardless of prior state', () => {
    let state = createInitialTimeTrialState(rng, 'all', false)
    state = timeTrialReducer(state, { type: 'PRELOADED', now: 0 })
    state = timeTrialReducer(state, { type: 'IMAGE_READY' })
    state = timeTrialReducer(state, { type: 'GUESS', pokemonId: state.rounds[0].pokemonId, now: 5 })

    const restarted = timeTrialReducer(state, { type: 'START', rng, generation: 'all', includeVariants: false })
    expect(restarted.status).toBe('preparing')
    expect(restarted.roundIndex).toBe(0)
    expect(restarted.results).toEqual([])
    expect(restarted.startedAt).toBeNull()
    expect(restarted.finishedAt).toBeNull()
  })
})

describe('formatElapsedMs', () => {
  it('formats milliseconds as m:ss.t', () => {
    expect(formatElapsedMs(0)).toBe('0:00.0')
    expect(formatElapsedMs(1234)).toBe('0:01.2')
    expect(formatElapsedMs(65432)).toBe('1:05.4')
  })
})

describe('isBetterTimeTrialResult', () => {
  it('is always better than no existing best', () => {
    expect(isBetterTimeTrialResult({ rank: 'D', elapsedMs: 99999, correct: 0 }, null)).toBe(true)
  })

  it('prefers a higher rank regardless of time', () => {
    expect(
      isBetterTimeTrialResult(
        { rank: 'A', elapsedMs: 99999, correct: 10 },
        { rank: 'B', elapsedMs: 100, correct: 9 },
      ),
    ).toBe(true)
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 100, correct: 9 },
        { rank: 'A', elapsedMs: 99999, correct: 10 },
      ),
    ).toBe(false)
  })

  it('within the same rank, prefers a faster time', () => {
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 50000, correct: 9 },
        { rank: 'B', elapsedMs: 60000, correct: 9 },
      ),
    ).toBe(true)
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 70000, correct: 9 },
        { rank: 'B', elapsedMs: 60000, correct: 9 },
      ),
    ).toBe(false)
  })

  it('is not better when rank and time both tie', () => {
    expect(
      isBetterTimeTrialResult(
        { rank: 'B', elapsedMs: 60000, correct: 9 },
        { rank: 'B', elapsedMs: 60000, correct: 9 },
      ),
    ).toBe(false)
  })
})
