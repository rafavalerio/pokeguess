import { describe, expect, it } from 'vitest'

import { getPokemonEntry, getPokemonName, getSpeciesDex } from './pokemon'

describe('getPokemonEntry', () => {
  it('resolves a base species by id', () => {
    expect(getPokemonEntry(1)).toEqual({ id: 1, name: 'Bulbasaur', speciesDex: 1 })
  })

  it('resolves a form to its own id but the base species dex', () => {
    const entry = getPokemonEntry(10033) // Mega Venusaur
    expect(entry.name).toBe('Mega Venusaur')
    expect(entry.speciesDex).toBe(3)
    expect(entry.id).toBe(10033)
  })

  it('falls back to a placeholder for an unknown id', () => {
    expect(getPokemonEntry(999999)).toEqual({ id: 999999, name: 'Unknown', speciesDex: 999999 })
  })
})

describe('getPokemonName', () => {
  it('returns the entry name', () => {
    expect(getPokemonName(1)).toBe('Bulbasaur')
  })
})

describe('getSpeciesDex', () => {
  it('returns the entry species dex', () => {
    expect(getSpeciesDex(10033)).toBe(3)
  })
})
