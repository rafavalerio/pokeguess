import generationDexRanges from './generationDexRanges.json'
import { pokemonList, type PokemonEntry } from './pokemonData'

export type Generation = {
  id: number
  label: string
  minDex: number
  maxDex: number
}

// Region names, parallel to generationDexRanges.json by generation id. Kept
// separate from the dex ranges themselves: scripts/build-pokemon-data.mjs
// reads that JSON too (to compute each entry's `generation`), and has no use
// for display labels.
const REGION_LABELS: Record<number, string> = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unova',
  6: 'Kalos',
  7: 'Alola',
  8: 'Galar',
  9: 'Paldea',
}

// National dex ranges for *base species*, standard across the series. A
// form's own generation (Mega, regional, Gigantamax) is baked into
// PokemonEntry.generation at data-generation time instead — see
// scripts/build-pokemon-data.mjs's FORM_GENERATION_BY_KIND — since a form is
// frequently introduced generations after its base species (e.g. Mega
// Charizard X is Generation 6, even though Charizard is Generation 1).
export const GENERATIONS: readonly Generation[] = generationDexRanges.map((range) => ({
  ...range,
  label: `Generation ${range.id} · ${REGION_LABELS[range.id]}`,
}))

export type GenerationFilter = 'all' | number

// Only used for lib/pokemon.ts's defensive fallback entry (an id with no
// match in pokemonList, which shouldn't happen in normal play). Falls back
// to the last generation for a dex past the known ranges rather than
// throwing, matching that fallback's best-effort spirit.
export const generationForDex = (dex: number): number =>
  GENERATIONS.find((generation) => dex >= generation.minDex && dex <= generation.maxDex)?.id ??
  GENERATIONS[GENERATIONS.length - 1].id

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

// A base species (id === speciesDex) is always in scope; a form (Mega,
// regional, Gigantamax — id !== speciesDex) is only in scope when
// includeVariants is true, and is then filtered by its own `generation`
// (when it was introduced), not its base species'.
export const pokemonPoolFor = (
  filter: GenerationFilter,
  includeVariants: boolean,
): readonly PokemonEntry[] =>
  pokemonList.filter((entry) => {
    if (!includeVariants && entry.id !== entry.speciesDex) return false
    return filter === 'all' || entry.generation === filter
  })

export const GENERATION_SELECT_OPTIONS: readonly { value: GenerationFilter; label: string }[] = [
  { value: 'all', label: 'All generations' },
  ...GENERATIONS.map((generation) => ({ value: generation.id, label: generation.label })),
]
