import { describe, expect, it } from 'vitest'

import {
  GENERATIONS,
  GENERATION_SELECT_OPTIONS,
  isValidGenerationFilter,
  parseGenerationFilter,
  pokemonListForGeneration,
} from './generations'
import { pokemonList } from './pokemonData'

describe('GENERATIONS', () => {
  it('covers the national dex with no gaps and no overlaps', () => {
    const sorted = GENERATIONS.toSorted((a, b) => a.minDex - b.minDex)
    expect(sorted[0].minDex).toBe(1)
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].minDex).toBe(sorted[i - 1].maxDex + 1)
    }
    expect(sorted[sorted.length - 1].maxDex).toBe(Math.max(...pokemonList.map((entry) => entry.speciesDex)))
  })
})

describe('pokemonListForGeneration', () => {
  it("returns the full list for 'all'", () => {
    expect(pokemonListForGeneration('all')).toBe(pokemonList)
  })

  it('only returns entries whose speciesDex falls in the generation range', () => {
    const gen1 = GENERATIONS.find((g) => g.id === 1)!
    const filtered = pokemonListForGeneration(1)
    expect(filtered.length).toBeGreaterThan(0)
    for (const entry of filtered) {
      expect(entry.speciesDex).toBeGreaterThanOrEqual(gen1.minDex)
      expect(entry.speciesDex).toBeLessThanOrEqual(gen1.maxDex)
    }
  })

  it('buckets a form (e.g. Mega Charizard) with the generation of its base species', () => {
    const megaCharizardX = pokemonList.find((entry) => entry.name === 'Mega Charizard X')
    expect(megaCharizardX).toBeDefined()
    const gen1 = pokemonListForGeneration(1)
    expect(gen1.some((entry) => entry.id === megaCharizardX!.id)).toBe(true)
  })

  it('together, every generation partitions pokemonList exactly (no entry missing or duplicated)', () => {
    const seen = new Set<number>()
    for (const generation of GENERATIONS) {
      for (const entry of pokemonListForGeneration(generation.id)) {
        expect(seen.has(entry.id)).toBe(false)
        seen.add(entry.id)
      }
    }
    expect(seen.size).toBe(pokemonList.length)
  })

  it('falls back to the full list for an unknown generation id', () => {
    expect(pokemonListForGeneration(999)).toBe(pokemonList)
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

describe('GENERATION_SELECT_OPTIONS', () => {
  it("starts with 'all' followed by one entry per generation, in order", () => {
    expect(GENERATION_SELECT_OPTIONS[0]).toEqual({ value: 'all', label: 'All generations' })
    expect(GENERATION_SELECT_OPTIONS.slice(1).map((option) => option.value)).toEqual(
      GENERATIONS.map((g) => g.id),
    )
  })
})
