import { describe, expect, it } from 'vitest'

import { getPokemonEntry, getPokemonName, getSpeciesDex, getSpriteUrl } from './pokemon'

describe('getPokemonEntry', () => {
  it('resolves a base species by id', () => {
    expect(getPokemonEntry(1)).toEqual({ id: 1, name: 'Bulbasaur', speciesDex: 1, generation: 1 })
  })

  it('resolves a form to its own id, the base species dex, and its own generation', () => {
    const entry = getPokemonEntry(10033) // Mega Venusaur
    expect(entry.name).toBe('Mega Venusaur')
    expect(entry.speciesDex).toBe(3)
    expect(entry.id).toBe(10033)
    // Mega Evolution was introduced in Generation 6, even though Venusaur
    // itself is Generation 1.
    expect(entry.generation).toBe(6)
  })

  it('falls back to a placeholder for an unknown id', () => {
    expect(getPokemonEntry(999999)).toEqual({ id: 999999, name: 'Unknown', speciesDex: 999999, generation: 9 })
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

describe('getSpriteUrl', () => {
  it("builds the sprite URL from the entry's own id, not its species dex", () => {
    expect(getSpriteUrl(10033)).toBe(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/10033.png',
    )
  })
})
