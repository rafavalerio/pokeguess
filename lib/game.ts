import { DEX_PROXIMITY, SIMILARITY_THRESHOLD, hardDistractorCountForStreak } from './gameConfig'
import { getPokemonEntry } from './pokemon'
import { pokemonList, type PokemonEntry } from './pokemonData'

export type Rng = () => number

export const randomPokemon = (rng: Rng): PokemonEntry =>
  pokemonList[Math.floor(rng() * pokemonList.length)]

export const randomPokemonExcluding = (rng: Rng, excludeIds: ReadonlySet<number>): PokemonEntry => {
  let guard = 0
  let candidate = randomPokemon(rng)
  while (excludeIds.has(candidate.id) && guard < 1000) {
    candidate = randomPokemon(rng)
    guard += 1
  }
  if (!excludeIds.has(candidate.id)) return candidate
  // Guard tripped: an enormous run has nearly exhausted the pool (or a
  // pathological rng). Deterministically wrap to the first still-unused
  // entry so the run keeps going instead of stalling.
  return pokemonList.find((entry) => !excludeIds.has(entry.id)) ?? candidate
}

const shuffle = <T,>(items: T[], rng: Rng): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const normalizeName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (Flabébé -> flabebe)
    .replace(/[^a-z0-9]/gi, '') // strip spaces, punctuation, gender symbols
    .toLowerCase()

const levenshteinDistance = (a: string, b: string): number => {
  const rows = a.length + 1
  const cols = b.length + 1
  const dp: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
  for (let i = 0; i < rows; i += 1) dp[i][0] = i
  for (let j = 0; j < cols; j += 1) dp[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[rows - 1][cols - 1]
}

export const spellingSimilarity = (nameA: string, nameB: string): number => {
  const a = normalizeName(nameA)
  const b = normalizeName(nameB)
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 0 : 1 - levenshteinDistance(a, b) / maxLen
}

export const isHardDistractor = (answer: PokemonEntry, candidate: PokemonEntry): boolean =>
  Math.abs(answer.speciesDex - candidate.speciesDex) <= DEX_PROXIMITY ||
  spellingSimilarity(answer.name, candidate.name) >= SIMILARITY_THRESHOLD

export const generateOptions = (answerId: number, streak: number, rng: Rng): number[] => {
  const answer = getPokemonEntry(answerId)
  const hardTarget = hardDistractorCountForStreak(streak)
  const options = new Set<number>([answerId])

  // Skipped entirely at hardTarget 0 (streak 0-2) so the rng call sequence
  // — and therefore every existing scripted-rng test — is untouched at low
  // streaks.
  if (hardTarget > 0) {
    const hardCandidates = shuffle(
      pokemonList.filter((entry) => entry.id !== answerId && isHardDistractor(answer, entry)),
      rng,
    )
    for (const candidate of hardCandidates) {
      if (options.size >= 1 + hardTarget) break
      options.add(candidate.id)
    }
  }

  let guard = 0
  while (options.size < 4 && guard < 1000) {
    options.add(randomPokemon(rng).id)
    guard += 1
  }
  // A degenerate rng (e.g. one that always returns the same value) can leave
  // the loop above short of 4 unique options even after the guard trips.
  // Deterministically fill any remaining slots so the result is always
  // exactly 4 unique ids.
  let index = 0
  while (options.size < Math.min(4, pokemonList.length)) {
    options.add(pokemonList[index].id)
    index = index >= pokemonList.length - 1 ? 0 : index + 1
  }
  return shuffle([...options], rng)
}

export type Status = 'loading' | 'guessing' | 'revealed' | 'won'

export type GameState = {
  status: Status
  pokemonId: number
  options: number[]
  guess: number | null
  streak: number
  bestStreak: number | null
  // Monotonically incrementing per round. A repeat draw (possible any time
  // two rounds in a row land on the same entry) leaves `pokemonId` unchanged
  // across NEXT, which would otherwise give consuming components
  // (PokemonSilhouette) no signal that a new round started. `roundId` always
  // changes on NEXT regardless of which entry was drawn, so it — not
  // `pokemonId` — is the correct thing to key a fresh element on.
  roundId: number
  // Answers drawn so far in the current unbroken streak ("run"). Cleared
  // whenever a run ends (see the NEXT case) so a fresh run can draw anything
  // again, including a Pokémon just shown in the run that just ended.
  usedIds: ReadonlySet<number>
}

export type GameAction =
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; pokemonId: number }
  | { type: 'NEXT'; rng: Rng }
  | { type: 'HYDRATE_BEST'; bestStreak: number }

const startRound = (
  rng: Rng,
  streak: number,
  usedIds: ReadonlySet<number>,
): Pick<GameState, 'status' | 'pokemonId' | 'options' | 'guess'> => {
  const pokemonId = randomPokemonExcluding(rng, usedIds).id
  return { status: 'loading', pokemonId, options: generateOptions(pokemonId, streak, rng), guess: null }
}

export const createInitialState = (rng: Rng): GameState => {
  const round = startRound(rng, 0, new Set())
  return { ...round, streak: 0, bestStreak: null, roundId: 0, usedIds: new Set([round.pokemonId]) }
}

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'IMAGE_READY':
      return state.status === 'loading' ? { ...state, status: 'guessing' } : state

    case 'GUESS': {
      if (state.status !== 'guessing') return state
      const correct = action.pokemonId === state.pokemonId
      const streak = correct ? state.streak + 1 : 0
      return {
        ...state,
        status: 'revealed',
        guess: action.pokemonId,
        streak,
        bestStreak: Math.max(streak, state.bestStreak ?? 0),
      }
    }

    case 'NEXT': {
      if (state.status === 'won') {
        // "Start again" from the win screen: a full reset, same as a broken streak.
        const round = startRound(action.rng, 0, new Set())
        return { ...state, ...round, streak: 0, usedIds: new Set([round.pokemonId]), roundId: state.roundId + 1 }
      }
      if (state.streak > 0 && state.usedIds.size === pokemonList.length) {
        // The round just revealed was the last unused entry in the pool.
        return { ...state, status: 'won' }
      }
      const usedIds = state.streak === 0 ? new Set<number>() : state.usedIds
      const round = startRound(action.rng, state.streak, usedIds)
      return { ...state, ...round, usedIds: new Set(usedIds).add(round.pokemonId), roundId: state.roundId + 1 }
    }

    case 'HYDRATE_BEST':
      return { ...state, bestStreak: Math.max(action.bestStreak, state.bestStreak ?? 0) }

    default:
      return state
  }
}
