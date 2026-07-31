import { describe, expect, it } from 'vitest'

import { pokemonList } from './pokemonData'
import { createInitialState, gameReducer, generateOptions, isHardDistractor, randomPokemon, randomPokemonExcluding, spellingSimilarity, type Rng } from './game'

const makeRng = (values: number[]): Rng => {
  let i = 0
  return () => values[i++ % values.length]
}

const validIds = new Set(pokemonList.map((entry) => entry.id))

const idAt = (rngValue: number) => pokemonList[Math.floor(rngValue * pokemonList.length)].id

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
    const pinnedId = idAt(0.5)
    let state = createInitialState(makeRng([0.5]))
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
