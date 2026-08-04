import { describe, expect, it } from 'vitest'

import { pokemonPoolFor } from './generations'
import { pokemonList } from './pokemonData'
import {
  createInitialState,
  gameReducer,
  generateOptions,
  generateOptionsWithHardTarget,
  isHardDistractor,
  randomPokemon,
  randomPokemonExcluding,
  spellingSimilarity,
  type GameState,
  type Rng,
} from './game'

const makeRng = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

const validIds = new Set(pokemonList.map((entry) => entry.id))

const idAt = (rngValue: number) => pokemonList[Math.floor(rngValue * pokemonList.length)].id

const allUsedIds = (): ReadonlySet<number> => new Set(pokemonList.map((entry) => entry.id))

describe('randomPokemon', () => {
  it('maps 0 to the first entry and just under 1 to the last entry', () => {
    expect(randomPokemon(() => 0)).toBe(pokemonList[0])
    expect(randomPokemon(() => 0.999999)).toBe(pokemonList[pokemonList.length - 1])
  })
})

describe('generateOptions', () => {
  it('always includes the answer', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const options = generateOptions(42, 0, makeRng([seed / 50]))
      expect(options).toContain(42)
    }
  })

  it('returns exactly four options', () => {
    expect(generateOptions(42, 0, makeRng([0.1, 0.2, 0.3]))).toHaveLength(4)
  })

  it('never returns duplicates', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const options = generateOptions(42, 0, makeRng([seed / 50]))
      expect(new Set(options).size).toBe(4)
    }
  })

  it('only returns ids that exist in pokemonList', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const option of generateOptions(42, 0, makeRng([seed / 50]))) {
        expect(validIds.has(option)).toBe(true)
      }
    }
  })

  it('makes progress even when the rng keeps returning the answer', () => {
    const answerDraw = 41 / pokemonList.length // resolves to pokemonList[41], id 42
    expect(generateOptions(42, 0, makeRng([answerDraw, 0.5, 0.6, 0.7]))).toHaveLength(4)
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

describe('spellingSimilarity', () => {
  it('scores identical-after-normalizing names as a perfect match', () => {
    // Nidoran♀ / Nidoran♂ normalize to the same string once the gender
    // symbols are stripped.
    expect(spellingSimilarity('Nidoran♀', 'Nidoran♂')).toBe(1)
  })

  it('scores names with no meaningful overlap as low similarity', () => {
    expect(spellingSimilarity('Weedle', 'Kakuna')).toBeLessThan(0.5)
    expect(spellingSimilarity('Bulbasaur', 'Mewtwo')).toBeLessThan(0.5)
  })
})

const findEntry = (id: number) => pokemonList.find((e) => e.id === id)!

describe('isHardDistractor', () => {
  const weedle = findEntry(13)
  const kakuna = findEntry(14)
  const nidoranFemale = findEntry(29)
  const nidoranMale = findEntry(32)
  const bulbasaur = findEntry(1)
  const mewtwo = findEntry(150)

  it('is true for dex-adjacent entries even with dissimilar names', () => {
    expect(isHardDistractor(kakuna, weedle)).toBe(true)
  })

  it('is true for similarly-spelled entries even when far apart in the dex', () => {
    expect(Math.abs(nidoranFemale.speciesDex - nidoranMale.speciesDex)).toBeGreaterThan(2)
    expect(isHardDistractor(nidoranFemale, nidoranMale)).toBe(true)
  })

  it('is false when neither signal matches', () => {
    expect(isHardDistractor(bulbasaur, mewtwo)).toBe(false)
  })
})

describe('generateOptions scales hard distractors with streak', () => {
  const kakunaId = 14 // dex 14; Butterfree(12)/Weedle(13)/Beedrill(15)/Pidgey(16) are all dex-adjacent hard candidates
  const kakuna = pokemonList.find((entry) => entry.id === kakunaId)!
  const hardCountIn = (options: number[]) =>
    options.filter(
      (id) => id !== kakunaId && isHardDistractor(kakuna, pokemonList.find((entry) => entry.id === id)!),
    ).length

  it('always includes at least one hard distractor once the streak reaches the first band (3-7)', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const options = generateOptions(kakunaId, 3, makeRng([seed / 20, 0.11, 0.22, 0.33, 0.44]))
      expect(hardCountIn(options)).toBeGreaterThanOrEqual(1)
    }
  })

  it('always includes at least two hard distractors once the streak reaches the second band (8-14)', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const options = generateOptions(kakunaId, 8, makeRng([seed / 20, 0.11, 0.22, 0.33, 0.44]))
      expect(hardCountIn(options)).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('generateOptionsWithHardTarget', () => {
  it('matches generateOptions at streak 0 (hardTarget 0)', () => {
    const rngValues = [0.1, 0.2, 0.3]
    expect(generateOptionsWithHardTarget(42, 0, makeRng(rngValues))).toEqual(
      generateOptions(42, 0, makeRng(rngValues)),
    )
  })

  it('accepts an explicit hard-distractor target, independent of any streak band', () => {
    const kakunaId = 14 // dex 14; Butterfree(12)/Weedle(13)/Beedrill(15)/Pidgey(16) are all dex-adjacent hard candidates
    const kakuna = pokemonList.find((entry) => entry.id === kakunaId)!
    const hardCountIn = (options: number[]) =>
      options.filter(
        (id) => id !== kakunaId && isHardDistractor(kakuna, pokemonList.find((entry) => entry.id === id)!),
      ).length

    for (let seed = 0; seed < 20; seed += 1) {
      // hardTarget 2 passed directly — no streak value maps to this in
      // DIFFICULTY_CURVE's band 1 (which yields 1), proving the target isn't
      // being derived from a streak internally.
      const options = generateOptionsWithHardTarget(kakunaId, 2, makeRng([seed / 20, 0.11, 0.22, 0.33, 0.44]))
      expect(hardCountIn(options)).toBeGreaterThanOrEqual(2)
    }
  })

  it('returns exactly four unique options that always include the answer', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const options = generateOptionsWithHardTarget(42, 1, makeRng([seed / 20, 0.11, 0.22, 0.33]))
      expect(options).toHaveLength(4)
      expect(new Set(options).size).toBe(4)
      expect(options).toContain(42)
    }
  })
})

describe('randomPokemonExcluding', () => {
  it('never returns an excluded id', () => {
    const excluded = new Set([pokemonList[0].id])
    for (let seed = 0; seed < 20; seed += 1) {
      const result = randomPokemonExcluding(makeRng([seed / 20]), excluded)
      expect(excluded.has(result.id)).toBe(false)
    }
  })

  it('falls back deterministically when the rng keeps landing on an excluded id', () => {
    const pinnedId = pokemonList[Math.floor(0.5 * pokemonList.length)].id
    const excluded = new Set([pinnedId])
    // rng is pinned to 0.5 forever, so every guard-loop attempt lands on the
    // excluded id — this only returns if the deterministic fallback kicks in.
    const result = randomPokemonExcluding(makeRng([0.5]), excluded)
    expect(result.id).not.toBe(pinnedId)
    expect(excluded.has(result.id)).toBe(false)
  })
})

describe('no-repeat within a run', () => {
  it('excludes the current run\'s drawn ids from the next draw while the streak continues', () => {
    const pinnedId = idAt(0.5)
    let state = createInitialState(makeRng([0.5]))
    expect(state.pokemonId).toBe(pinnedId)
    expect(state.usedIds.has(pinnedId)).toBe(true)

    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // correct, streak 1
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    // rng always resolves to pinnedId; since it's already used this run, the
    // draw must fall back to a different entry rather than repeating it.
    expect(state.pokemonId).not.toBe(pinnedId)
    expect(state.usedIds.has(pinnedId)).toBe(true)
    expect(state.usedIds.has(state.pokemonId)).toBe(true)
    expect(state.usedIds.size).toBe(2)
  })

  it('resets the exclusion set once the streak breaks', () => {
    // SET_GENERATION (includeVariants: true) puts the run on the full
    // pokemonList pool, matching idAt's assumption; createInitialState's own
    // pre-mount round is drawn against the full list too but that's a
    // hydration-safety exception, not what a real run uses by default (see
    // the includeVariants describe block below) — so this test starts a run
    // explicitly rather than relying on the raw createInitialState draw.
    let state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
    state = gameReducer(state, {
      type: 'SET_GENERATION',
      rng: makeRng([0.5]),
      generation: 'all',
      includeVariants: true,
      bestStreak: null,
    })
    const pinnedId = state.pokemonId
    state = gameReducer(state, { type: 'IMAGE_READY' })
    const wrong = state.options.find((o) => o !== state.pokemonId)!
    state = gameReducer(state, { type: 'GUESS', pokemonId: wrong }) // wrong, streak 0
    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    // The run just restarted, so the exclusion set is empty again and the
    // pinned draw is free to repeat.
    expect(state.pokemonId).toBe(pinnedId)
    expect(state.usedIds.size).toBe(1)
    expect(state.usedIds.has(pinnedId)).toBe(true)
  })
})

describe('HYDRATE_RUN', () => {
  it('ignores a stored streak of zero, keeping the freshly drawn round', () => {
    const state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
    const hydrated = gameReducer(state, {
      type: 'HYDRATE_RUN',
      rng: makeRng([0.5]),
      streak: 0,
      usedIds: new Set(),
      generation: 'all',
      includeVariants: false,
    })
    expect(hydrated).toBe(state)
  })

  it('restores the streak and redraws a round excluding the stored usedIds', () => {
    const pinnedId = idAt(0.5)
    const state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
    const usedIds = new Set([pinnedId])

    const hydrated = gameReducer(state, {
      type: 'HYDRATE_RUN',
      rng: makeRng([0.5]),
      streak: 4,
      usedIds,
      generation: 'all',
      includeVariants: false,
    })

    expect(hydrated.streak).toBe(4)
    // rng always resolves to pinnedId, which is already in the restored
    // usedIds, so the redraw must fall back to a different entry.
    expect(hydrated.pokemonId).not.toBe(pinnedId)
    expect(hydrated.usedIds.has(pinnedId)).toBe(true)
    expect(hydrated.usedIds.has(hydrated.pokemonId)).toBe(true)
    expect(hydrated.status).toBe('loading')
  })

  it('goes straight to won when the stored usedIds already covers the whole pool', () => {
    const state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
    const usedIds = allUsedIds()

    const hydrated = gameReducer(state, {
      type: 'HYDRATE_RUN',
      rng: makeRng([0.5]),
      streak: pokemonList.length,
      usedIds,
      generation: 'all',
      includeVariants: true,
    })

    expect(hydrated.status).toBe('won')
    expect(hydrated.streak).toBe(pokemonList.length)
  })
})

describe('RESTART', () => {
  it('abandons an in-progress run: streak and usedIds reset, a fresh round is drawn', () => {
    // See the identical comment in the 'no-repeat within a run' describe
    // block above: SET_GENERATION puts the run on a known (full-list) pool
    // so idAt's assumption holds, rather than relying on createInitialState's
    // hydration-only pre-mount draw.
    let state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
    state = gameReducer(state, {
      type: 'SET_GENERATION',
      rng: makeRng([0.5]),
      generation: 'all',
      includeVariants: true,
      bestStreak: null,
    })
    const pinnedId = state.pokemonId
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // correct, streak 1
    expect(state.streak).toBe(1)

    const restarted = gameReducer(state, { type: 'RESTART', rng: makeRng([0.5]) })

    expect(restarted.streak).toBe(0)
    expect(restarted.status).toBe('loading')
    expect(restarted.pokemonId).toBe(pinnedId)
    expect(restarted.usedIds.size).toBe(1)
    expect(restarted.usedIds.has(restarted.pokemonId)).toBe(true)
  })

  it('leaves the best streak untouched', () => {
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // correct, streak 1, bestStreak 1

    const restarted = gameReducer(state, { type: 'RESTART', rng: makeRng([0.5]) })

    expect(restarted.bestStreak).toBe(1)
  })

  it('increments roundId, matching NEXT and HYDRATE_RUN', () => {
    const state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
    const restarted = gameReducer(state, { type: 'RESTART', rng: makeRng([0.5]) })
    expect(restarted.roundId).toBe(state.roundId + 1)
  })
})

describe('winning the game', () => {
  it('reveals the final correct guess normally, without winning yet', () => {
    const lastId = pokemonList[0].id
    const state: GameState = {
      status: 'guessing',
      pokemonId: lastId,
      options: [lastId, pokemonList[1].id, pokemonList[2].id, pokemonList[3].id],
      guess: null,
      streak: 5,
      bestStreak: 5,
      roundId: 5,
      usedIds: allUsedIds(),
      generation: 'all',
      includeVariants: true,
      isNewBest: false,
    }

    const revealed = gameReducer(state, { type: 'GUESS', pokemonId: lastId })

    expect(revealed.status).toBe('revealed')
    expect(revealed.streak).toBe(6)
  })

  it('transitions to won on the NEXT after the last correct guess, without drawing a new round', () => {
    const lastId = pokemonList[0].id
    const state: GameState = {
      status: 'revealed',
      pokemonId: lastId,
      options: [lastId, pokemonList[1].id, pokemonList[2].id, pokemonList[3].id],
      guess: lastId,
      streak: 6,
      bestStreak: 6,
      roundId: 5,
      usedIds: allUsedIds(),
      generation: 'all',
      includeVariants: true,
      isNewBest: false,
    }

    const won = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    expect(won.status).toBe('won')
    expect(won.pokemonId).toBe(lastId)
    expect(won.streak).toBe(6)
  })

  it('starts a completely fresh run from the won screen', () => {
    const state: GameState = {
      status: 'won',
      pokemonId: pokemonList[0].id,
      options: pokemonList.slice(0, 4).map((entry) => entry.id),
      guess: pokemonList[0].id,
      streak: pokemonList.length,
      bestStreak: pokemonList.length,
      roundId: 5,
      usedIds: allUsedIds(),
      generation: 'all',
      includeVariants: true,
      isNewBest: false,
    }

    const restarted = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

    expect(restarted.status).toBe('loading')
    expect(restarted.streak).toBe(0)
    expect(restarted.usedIds.size).toBe(1)
    expect(restarted.usedIds.has(restarted.pokemonId)).toBe(true)
    expect(restarted.bestStreak).toBe(pokemonList.length) // untouched by a restart
  })
})

describe('generation-scoped pools', () => {
  const gen1Pool = pokemonPoolFor(1, true)
  const gen1Ids = new Set(gen1Pool.map((entry) => entry.id))

  it('randomPokemon only draws from the given pool', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      expect(gen1Ids.has(randomPokemon(makeRng([seed / 20]), gen1Pool).id)).toBe(true)
    }
  })

  it('generateOptions only returns ids from the given pool', () => {
    const answerId = gen1Pool[0].id
    for (let seed = 0; seed < 20; seed += 1) {
      const options = generateOptions(answerId, 0, makeRng([seed / 20]), gen1Pool)
      for (const option of options) expect(gen1Ids.has(option)).toBe(true)
    }
  })

  describe('SET_GENERATION', () => {
    it('draws the fresh round from the new generation, resets the streak, and adopts the supplied best streak', () => {
      let state = createInitialState(makeRng([0.5]))
      state = gameReducer(state, { type: 'IMAGE_READY' })
      state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // correct, streak 1

      const switched = gameReducer(state, {
        type: 'SET_GENERATION',
        rng: makeRng([0.1]),
        generation: 1,
        includeVariants: true,
        bestStreak: 42,
      })

      expect(switched.generation).toBe(1)
      expect(switched.streak).toBe(0)
      expect(switched.status).toBe('loading')
      expect(gen1Ids.has(switched.pokemonId)).toBe(true)
      expect(switched.usedIds).toEqual(new Set([switched.pokemonId]))
      expect(switched.bestStreak).toBe(42)
    })

    it('accepts a null best streak (no prior best for that generation)', () => {
      const state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
      const switched = gameReducer(state, {
        type: 'SET_GENERATION',
        rng: makeRng([0.1]),
        generation: 3,
        includeVariants: true,
        bestStreak: null,
      })
      expect(switched.bestStreak).toBeNull()
    })
  })

  describe('win condition scoped to the active generation', () => {
    it('wins once usedIds covers the generation pool, well before the full pokemonList', () => {
      expect(gen1Pool.length).toBeLessThan(pokemonList.length)
      const lastId = gen1Pool[0].id
      const state: GameState = {
        status: 'revealed',
        pokemonId: lastId,
        options: [lastId, gen1Pool[1].id, gen1Pool[2].id, gen1Pool[3].id],
        guess: lastId,
        streak: gen1Pool.length,
        bestStreak: gen1Pool.length,
        roundId: 5,
        usedIds: gen1Ids,
        generation: 1,
        includeVariants: true,
        isNewBest: false,
      }

      const won = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })

      expect(won.status).toBe('won')
      expect(won.pokemonId).toBe(lastId)
    })

    it('HYDRATE_RUN lands on won when the stored run already covers the generation pool', () => {
      const state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))
      const hydrated = gameReducer(state, {
        type: 'HYDRATE_RUN',
        rng: makeRng([0.5]),
        streak: gen1Pool.length,
        usedIds: gen1Ids,
        generation: 1,
        includeVariants: true,
      })

      expect(hydrated.status).toBe('won')
      expect(hydrated.generation).toBe(1)
    })
  })
})

describe('includeVariants', () => {
  it('defaults to false for a freshly created state', () => {
    expect(createInitialState(makeRng([0.1, 0.2, 0.3, 0.4])).includeVariants).toBe(false)
  })

  it('SET_GENERATION with includeVariants false only ever draws base species', () => {
    const state = createInitialState(makeRng([0.1, 0.2, 0.3, 0.4]))

    for (let seed = 0; seed < 20; seed += 1) {
      const excluded = gameReducer(state, {
        type: 'SET_GENERATION',
        rng: makeRng([seed / 20]),
        generation: 'all',
        includeVariants: false,
        bestStreak: null,
      })
      expect(excluded.includeVariants).toBe(false)
      const entry = pokemonList.find((e) => e.id === excluded.pokemonId)!
      expect(entry.id).toBe(entry.speciesDex)
    }
  })

  it('RESTART keeps the current includeVariants setting', () => {
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, {
      type: 'SET_GENERATION',
      rng: makeRng([0.1]),
      generation: 'all',
      includeVariants: true,
      bestStreak: null,
    })

    const restarted = gameReducer(state, { type: 'RESTART', rng: makeRng([0.5]) })
    expect(restarted.includeVariants).toBe(true)
  })

  it('the win condition pool shrinks to base species only when includeVariants is false', () => {
    const baseSpeciesOnly = pokemonPoolFor('all', false)
    const everything = pokemonPoolFor('all', true)
    expect(baseSpeciesOnly.length).toBeLessThan(everything.length)

    const lastId = baseSpeciesOnly[0].id
    const state: GameState = {
      status: 'revealed',
      pokemonId: lastId,
      options: [lastId, baseSpeciesOnly[1].id, baseSpeciesOnly[2].id, baseSpeciesOnly[3].id],
      guess: lastId,
      streak: baseSpeciesOnly.length,
      bestStreak: baseSpeciesOnly.length,
      roundId: 5,
      usedIds: new Set(baseSpeciesOnly.map((entry) => entry.id)),
      generation: 'all',
      includeVariants: false,
      isNewBest: false,
    }

    const won = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })
    expect(won.status).toBe('won')
  })
})

describe('isNewBest', () => {
  it('flags the very first correct guess ever as a new best (bestStreak starts null)', () => {
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })

    expect(state.isNewBest).toBe(true)
    expect(state.bestStreak).toBe(1)
  })

  it('does not flag merely tying an existing best', () => {
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, { type: 'HYDRATE_BEST', bestStreak: 1 })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // streak 1, ties the existing best

    expect(state.isNewBest).toBe(false)
    expect(state.bestStreak).toBe(1)
  })

  it('flags a correct guess that exceeds the prior best', () => {
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, { type: 'HYDRATE_BEST', bestStreak: 1 })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // streak 1, ties
    expect(state.isNewBest).toBe(false)

    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // streak 2, exceeds

    expect(state.isNewBest).toBe(true)
    expect(state.bestStreak).toBe(2)
  })

  it('carries the flag forward through the wrong guess that ends the run, rather than clearing it', () => {
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId }) // correct, first-ever best
    expect(state.isNewBest).toBe(true)

    state = gameReducer(state, { type: 'NEXT', rng: makeRng([0.5]) })
    state = gameReducer(state, { type: 'IMAGE_READY' })
    const wrong = state.options.find((o) => o !== state.pokemonId)!
    state = gameReducer(state, { type: 'GUESS', pokemonId: wrong }) // wrong, ends the run

    expect(state.streak).toBe(0)
    expect(state.isNewBest).toBe(true)
  })

  it('resets to false at the start of a fresh run', () => {
    let state = createInitialState(makeRng([0.5]))
    state = gameReducer(state, { type: 'IMAGE_READY' })
    state = gameReducer(state, { type: 'GUESS', pokemonId: state.pokemonId })
    expect(state.isNewBest).toBe(true)

    const restarted = gameReducer(state, { type: 'RESTART', rng: makeRng([0.5]) })
    expect(restarted.isNewBest).toBe(false)
  })
})
