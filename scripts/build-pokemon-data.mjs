import { writeFileSync, readFileSync } from 'node:fs'

const SPECIES_NAMES = JSON.parse(readFileSync(new URL('./species-names.json', import.meta.url)))

// Markers that mean "this is a battle-only or cosmetic variant riding on an
// in-scope suffix, not the regional form / mega / gigantamax itself" — e.g.
// raticate-totem-alola, darmanitan-galar-zen, pikachu-alola-cap. Matched
// per hyphen-separated segment (see isExcluded below), not as a substring,
// so this can't silently over-match a species name that merely contains one
// of these words (zamazenta, capsakid, finizen, ...).
const EXCLUDE_MARKERS = ['totem', 'zen', 'cap', 'starter']

const isExcluded = (name) => name.split('-').some((seg) => EXCLUDE_MARKERS.includes(seg))

// A handful of species whose PokeAPI name carries an extra gender- or
// cosmetic-form segment before the mega/gmax suffix that doesn't match the
// species name directly. This is a closed, known set, not a heuristic —
// extend it only if a future game adds another species shaped like this.
// `style` disambiguates entries that would otherwise share a display name
// (Toxtricity and Urshifu each have two named Gigantamax styles that resolve
// to the same speciesDex). Entries with no `style` (Meowstic, Tatsugiri) are
// the only named Mega for their species once the sibling cosmetic/gender
// duplicate is dropped, so they get the plain "Mega <species>" name.
const FORM_BASE_OVERRIDES = {
  'toxtricity-amped': { base: 'toxtricity', style: 'amped' },
  'toxtricity-low-key': { base: 'toxtricity', style: 'low-key' },
  'urshifu-single-strike': { base: 'urshifu', style: 'single-strike' },
  'urshifu-rapid-strike': { base: 'urshifu', style: 'rapid-strike' },
  'meowstic-male': { base: 'meowstic' },
  'tatsugiri-stretchy': { base: 'tatsugiri' },
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
  if (isExcluded(raw)) continue
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

  const cosmetic = FORM_BASE_OVERRIDES[stripped]
  if (!cosmetic) {
    dropped.push(raw)
    continue
  }
  const dex = speciesDexByName.get(cosmetic.base)
  // `style` disambiguates the styled Gigantamax pairs (Toxtricity, Urshifu);
  // entries with no style (Meowstic, Tatsugiri) get the plain kind name
  // ("Mega <species>") since they're the only surviving form for that base.
  const name = cosmetic.style
    ? displayName(speciesDisplayName(dex), 'gmax-cosmetic', cosmetic.style)
    : displayName(speciesDisplayName(dex), kind)
  entries.push({
    id: idFromUrl(p.url),
    name,
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
