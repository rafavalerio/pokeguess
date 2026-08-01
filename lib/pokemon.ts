import { generationForDex } from './generations'
import { pokemonList, type PokemonEntry } from './pokemonData'

const entryById = new Map<number, PokemonEntry>(pokemonList.map((entry) => [entry.id, entry]))

export const getPokemonEntry = (id: number): PokemonEntry =>
  entryById.get(id) ?? { id, name: 'Unknown', speciesDex: id, generation: generationForDex(id) }

export const getPokemonName = (id: number): string => getPokemonEntry(id).name

export const getSpeciesDex = (id: number): number => getPokemonEntry(id).speciesDex

const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

export const getSpriteUrl = (id: number): string => `${SPRITE_BASE}/${id}.png`
