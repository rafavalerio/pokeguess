import { pokemonList, type PokemonEntry } from './pokemonData'

export type Generation = {
  id: number
  label: string
  minDex: number
  maxDex: number
}

// National dex ranges, standard across the series. speciesDex is what forms
// (Mega, regional, Gigantamax) share with their base species, so a form is
// bucketed into whichever generation introduced that species, not the
// generation its form was introduced in.
export const GENERATIONS: readonly Generation[] = [
  { id: 1, label: 'Generation 1 · Kanto', minDex: 1, maxDex: 151 },
  { id: 2, label: 'Generation 2 · Johto', minDex: 152, maxDex: 251 },
  { id: 3, label: 'Generation 3 · Hoenn', minDex: 252, maxDex: 386 },
  { id: 4, label: 'Generation 4 · Sinnoh', minDex: 387, maxDex: 493 },
  { id: 5, label: 'Generation 5 · Unova', minDex: 494, maxDex: 649 },
  { id: 6, label: 'Generation 6 · Kalos', minDex: 650, maxDex: 721 },
  { id: 7, label: 'Generation 7 · Alola', minDex: 722, maxDex: 809 },
  { id: 8, label: 'Generation 8 · Galar', minDex: 810, maxDex: 905 },
  { id: 9, label: 'Generation 9 · Paldea', minDex: 906, maxDex: 1025 },
]

export type GenerationFilter = 'all' | number

const generationById = new Map(GENERATIONS.map((generation) => [generation.id, generation]))

export const isValidGenerationFilter = (value: unknown): value is GenerationFilter =>
  value === 'all' || (typeof value === 'number' && generationById.has(value))

// Serializes to/from localStorage, where everything is a string. Anything
// that doesn't round-trip to a known generation (or 'all') falls back to
// 'all' rather than throwing, matching how the rest of Game.tsx's stored-state
// reads are best-effort.
export const parseGenerationFilter = (value: string | null): GenerationFilter => {
  if (value === 'all') return 'all'
  const id = Number(value)
  return isValidGenerationFilter(id) ? id : 'all'
}

export const pokemonListForGeneration = (filter: GenerationFilter): readonly PokemonEntry[] => {
  if (filter === 'all') return pokemonList
  const generation = generationById.get(filter)
  if (!generation) return pokemonList
  return pokemonList.filter((entry) => entry.speciesDex >= generation.minDex && entry.speciesDex <= generation.maxDex)
}

export const GENERATION_SELECT_OPTIONS: readonly { value: GenerationFilter; label: string }[] = [
  { value: 'all', label: 'All generations' },
  ...GENERATIONS.map((generation) => ({ value: generation.id, label: generation.label })),
]
