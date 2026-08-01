import { describe, expect, it } from 'vitest'

import {
  GENERATIONS,
  GENERATION_SELECT_OPTIONS,
  generationForDex,
  isValidGenerationFilter,
  parseGenerationFilter,
  pokemonPoolFor,
} from './generations'
import { pokemonList } from './pokemonData'

describe('GENERATIONS', () => {
  it('covers the national dex with no gaps and no overlaps', () => {
    const sorted = GENERATIONS.toSorted((a, b) => a.minDex - b.minDex)
    expect(sorted[0].minDex).toBe(1)
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].minDex).toBe(sorted[i - 1].maxDex + 1)
    }
    expect(sorted[sorted.length - 1].maxDex).toBe(
      Math.max(...pokemonList.filter((entry) => entry.id === entry.speciesDex).map((entry) => entry.speciesDex)),
    )
  })
})

describe('every PokemonEntry.generation is a known generation id', () => {
  it('never falls outside 1-9', () => {
    for (const entry of pokemonList) {
      expect(GENERATIONS.some((generation) => generation.id === entry.generation)).toBe(true)
    }
  })
})

const findByName = (name: string) => pokemonList.find((entry) => entry.name === name)

describe('form generation is the generation the form itself was introduced in, not its base species', () => {
  // These are well-established, stable facts about when each form type was
  // introduced (Mega Evolution: X/Y; Alolan: Sun/Moon; Galarian/Gigantamax:
  // Sword/Shield; Hisuian: Legends Arceus; Paldean: Scarlet/Violet) — not
  // derived from the base species' own generation.
  it.each([
    ['Bulbasaur', 1],
    ['Mega Charizard X', 6],
    ['Mega Charizard Y', 6],
    ['Alolan Raichu', 7],
    ['Galarian Zigzagoon', 8],
    ['Gigantamax Charizard', 8],
    ['Hisuian Zorua', 8],
    ['Paldean Wooper', 9],
  ])('%s -> generation %i', (name, expectedGeneration) => {
    const entry = findByName(name)
    expect(entry).toBeDefined()
    expect(entry?.generation).toBe(expectedGeneration)
  })

  it("places Mega Charizard X in generation 6's pool, not generation 1's", () => {
    const megaCharizardX = findByName('Mega Charizard X')!
    expect(pokemonPoolFor(6, true).some((entry) => entry.id === megaCharizardX.id)).toBe(true)
    expect(pokemonPoolFor(1, true).some((entry) => entry.id === megaCharizardX.id)).toBe(false)
  })
})

describe('pokemonPoolFor', () => {
  it("returns every entry for ('all', true)", () => {
    expect(pokemonPoolFor('all', true)).toEqual(pokemonList)
  })

  it('excludes every form when includeVariants is false, regardless of generation', () => {
    const pool = pokemonPoolFor('all', false)
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((entry) => entry.id === entry.speciesDex)).toBe(true)
  })

  it('only returns entries whose own generation matches, when a generation is picked', () => {
    const pool = pokemonPoolFor(1, true)
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((entry) => entry.generation === 1)).toBe(true)
  })

  it('combines both filters: base species from one generation only', () => {
    const pool = pokemonPoolFor(1, false)
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((entry) => entry.generation === 1 && entry.id === entry.speciesDex)).toBe(true)
  })

  it('returns an empty pool for an unknown generation id (guarded upstream by isValidGenerationFilter)', () => {
    expect(pokemonPoolFor(999, true)).toEqual([])
  })
})

describe('isValidGenerationFilter', () => {
  it("accepts 'all' and every known generation id", () => {
    expect(isValidGenerationFilter('all')).toBe(true)
    for (const generation of GENERATIONS) {
      expect(isValidGenerationFilter(generation.id)).toBe(true)
    }
  })

  it('rejects unknown ids and other types', () => {
    expect(isValidGenerationFilter(999)).toBe(false)
    expect(isValidGenerationFilter('gen1')).toBe(false)
    expect(isValidGenerationFilter(null)).toBe(false)
  })
})

describe('parseGenerationFilter', () => {
  it("round-trips 'all' and numeric generation ids", () => {
    expect(parseGenerationFilter('all')).toBe('all')
    expect(parseGenerationFilter('3')).toBe(3)
  })

  it('falls back to \'all\' for null, garbage, or unknown ids', () => {
    expect(parseGenerationFilter(null)).toBe('all')
    expect(parseGenerationFilter('not-a-generation')).toBe('all')
    expect(parseGenerationFilter('999')).toBe('all')
  })
})

describe('generationForDex', () => {
  it('maps a dex number to the generation whose range covers it', () => {
    expect(generationForDex(1)).toBe(1)
    expect(generationForDex(151)).toBe(1)
    expect(generationForDex(152)).toBe(2)
    expect(generationForDex(1025)).toBe(9)
  })

  it('falls back to the last generation for a dex past every known range', () => {
    expect(generationForDex(999999)).toBe(GENERATIONS[GENERATIONS.length - 1].id)
  })
})

describe('GENERATION_SELECT_OPTIONS', () => {
  it("starts with 'all' followed by one entry per generation, in order", () => {
    expect(GENERATION_SELECT_OPTIONS[0]).toEqual({ value: 'all', label: 'All generations' })
    expect(GENERATION_SELECT_OPTIONS.slice(1).map((option) => option.value)).toEqual(
      GENERATIONS.map((g) => g.id),
    )
  })
})
