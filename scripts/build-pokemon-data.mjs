import { writeFileSync, readFileSync } from 'node:fs'

const SPECIES_NAMES = JSON.parse(readFileSync(new URL('./species-names.json', import.meta.url)))

// Markers that mean "this is a battle-only or cosmetic variant riding on an
// in-scope suffix, not the regional form / mega / gigantamax itself" — e.g.
// raticate-totem-alola, darmanitan-galar-zen, pikachu-alola-cap.
const EXCLUDE_MARKERS = ['totem', 'zen', 'cap', 'starter']

// A handful of Gigantamax species whose PokeAPI name carries an extra
// cosmetic-form segment before "-gmax" that doesn't match the species name
// directly (Toxtricity and Urshifu each have two named styles). This is a
// closed, known set, not a heuristic — extend it only if a future game adds
// another species shaped like this. `style` disambiguates the two entries
// that would otherwise share a display name (both resolve to the same
// speciesDex and both are "Gigantamax <species>").
const COSMETIC_GMAX_EXCEPTIONS = {
  'toxtricity-amped': { base: 'toxtricity', style: 'amped' },
  'toxtricity-low-key': { base: 'toxtricity', style: 'low-key' },
  'urshifu-single-strike': { base: 'urshifu', style: 'single-strike' },
  'urshifu-rapid-strike': { base: 'urshifu', style: 'rapid-strike' },
}

const SUFFIXES = [
  ['-mega-x', 'mega-x'],
  ['-mega-y', 'mega-y'],
  ['-mega', 'mega'],
  ['-gmax', 'gmax'],
  ['-alola', 'alola'],
  ['-galar', 'galar'],
  ['-hisui', 'hisui'],
]

const PALDEA_BREED_RE = /^(.+)-paldea-(\w+)-breed$/

// 'low-key' -> 'Low Key', 'single-strike' -> 'Single Strike'
const titleCaseWords = (hyphenated) =>
  hyphenated
    .split('-')
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(' ')

const displayName = (speciesName, kind, extra) => {
  switch (kind) {
    case 'mega': return `Mega ${speciesName}`
    case 'mega-x': return `Mega ${speciesName} X`
    case 'mega-y': return `Mega ${speciesName} Y`
    case 'gmax': return `Gigantamax ${speciesName}`
    case 'gmax-cosmetic': return `Gigantamax ${speciesName} (${titleCaseWords(extra)})`
    case 'alola': return `Alolan ${speciesName}`
    case 'galar': return `Galarian ${speciesName}`
    case 'hisui': return `Hisuian ${speciesName}`
    case 'paldea': return `Paldean ${speciesName}`
    case 'paldea-breed': return `Paldean ${speciesName} (${extra[0].toUpperCase()}${extra.slice(1)} Breed)`
    default: throw new Error(`unhandled kind: ${kind}`)
  }
}

const idFromUrl = (url) => Number(url.split('/').filter(Boolean).pop())

const fetchAll = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  const body = await res.json()
  if (body.next !== null) throw new Error(`${url} is paginated (next: ${body.next}); raise the limit`)
  if (body.results.length !== body.count) {
    throw new Error(`${url}: expected ${body.count} results, got ${body.results.length}`)
  }
  return body.results
}

console.log('Fetching species list...')
const speciesResults = await fetchAll('https://pokeapi.co/api/v2/pokemon-species?limit=2000')
const speciesDexByName = new Map(speciesResults.map((s) => [s.name, idFromUrl(s.url)]))

console.log('Fetching pokemon list...')
const pokemonResults = await fetchAll('https://pokeapi.co/api/v2/pokemon?limit=2000')

if (speciesDexByName.size !== SPECIES_NAMES.length) {
  throw new Error(
    `PokeAPI has ${speciesDexByName.size} species but species-names.json has ${SPECIES_NAMES.length}; ` +
      'update Task 1 before regenerating.',
  )
}

const speciesDisplayName = (dex) => {
  const name = SPECIES_NAMES[dex - 1]
  if (!name) throw new Error(`no display name for dex ${dex} in species-names.json`)
  return name
}

const entries = []
for (const [, dex] of speciesDexByName) {
  entries.push({ id: dex, name: speciesDisplayName(dex), speciesDex: dex })
}

const dropped = []
for (const p of pokemonResults) {
  const raw = p.name
  if (EXCLUDE_MARKERS.some((marker) => raw.includes(marker))) continue
  const normalized = raw.replace(/-standard$/, '')

  const breedMatch = normalized.match(PALDEA_BREED_RE)
  if (breedMatch) {
    const [, base, flavor] = breedMatch
    const dex = speciesDexByName.get(base)
    if (dex) {
      entries.push({
        id: idFromUrl(p.url),
        name: displayName(speciesDisplayName(dex), 'paldea-breed', flavor),
        speciesDex: dex,
      })
    } else {
      dropped.push(raw)
    }
    continue
  }

  if (normalized.endsWith('-paldea')) {
    const base = normalized.slice(0, -'-paldea'.length)
    const dex = speciesDexByName.get(base)
    if (dex) {
      entries.push({ id: idFromUrl(p.url), name: displayName(speciesDisplayName(dex), 'paldea'), speciesDex: dex })
    } else {
      dropped.push(raw)
    }
    continue
  }

  const suffixMatch = SUFFIXES.find(([suffix]) => normalized.endsWith(suffix))
  if (!suffixMatch) continue
  const [suffix, kind] = suffixMatch
  const stripped = normalized.slice(0, -suffix.length)

  if (speciesDexByName.has(stripped)) {
    const dex = speciesDexByName.get(stripped)
    entries.push({ id: idFromUrl(p.url), name: displayName(speciesDisplayName(dex), kind), speciesDex: dex })
    continue
  }

  const cosmetic = COSMETIC_GMAX_EXCEPTIONS[stripped]
  if (!cosmetic) {
    dropped.push(raw)
    continue
  }
  const dex = speciesDexByName.get(cosmetic.base)
  entries.push({
    id: idFromUrl(p.url),
    name: displayName(speciesDisplayName(dex), 'gmax-cosmetic', cosmetic.style),
    speciesDex: dex,
  })
}

entries.sort((a, b) => a.id - b.id)

console.log(`Base species: ${speciesDexByName.size}`)
console.log(`Forms included: ${entries.length - speciesDexByName.size}`)
console.log(`Total entries: ${entries.length}`)
console.log(`Dropped (no species match — review before trusting): ${JSON.stringify(dropped)}`)

const banner = `// GENERATED FILE — do not hand-edit.
// Regenerate with \`npm run pokemon:build\` (scripts/build-pokemon-data.mjs).
`
const body =
  banner +
  '\nexport type PokemonEntry = {\n  id: number\n  name: string\n  speciesDex: number\n}\n\n' +
  'export const pokemonList: readonly PokemonEntry[] = ' +
  JSON.stringify(entries, null, 2) +
  '\n'

writeFileSync(new URL('../lib/pokemonData.ts', import.meta.url), body)
console.log('Wrote lib/pokemonData.ts')
