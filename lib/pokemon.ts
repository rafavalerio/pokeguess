import { pokemonList, type PokemonEntry } from './pokemonData'

const entryById = new Map<number, PokemonEntry>(pokemonList.map((entry) => [entry.id, entry]))

export const getPokemonEntry = (id: number): PokemonEntry =>
  entryById.get(id) ?? { id, name: 'Unknown', speciesDex: id }

export const getPokemonName = (id: number): string => getPokemonEntry(id).name

export const getSpeciesDex = (id: number): number => getPokemonEntry(id).speciesDex
