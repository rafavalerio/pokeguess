import { DEX_PROXIMITY, SIMILARITY_THRESHOLD, hardDistractorCountForStreak } from './gameConfig'
import { pokemonPoolFor, type GenerationFilter } from './generations'
import { getPokemonEntry } from './pokemon'
import { pokemonList, type PokemonEntry } from './pokemonData'

export type Rng = () => number

// Every draw function below takes the candidate pool explicitly rather than
// always reading pokemonList, so the same logic serves both "all Pokémon"
// and a generation-filtered run. It defaults to the full pokemonList so
// call sites (and existing tests) that don't care about generations don't
// need to pass one.
export const randomPokemon = (rng: Rng, pool: readonly PokemonEntry[] = pokemonList): PokemonEntry =>
  pool[Math.floor(rng() * pool.length)]

export const randomPokemonExcluding = (
  rng: Rng,
  excludeIds: ReadonlySet<number>,
  pool: readonly PokemonEntry[] = pokemonList,
): PokemonEntry => {
  let guard = 0
  let candidate = randomPokemon(rng, pool)
  while (excludeIds.has(candidate.id) && guard < 1000) {
    candidate = randomPokemon(rng, pool)
    guard += 1
  }
  if (!excludeIds.has(candidate.id)) return candidate
  // Guard tripped: an enormous run has nearly exhausted the pool (or a
  // pathological rng). Deterministically wrap to the first still-unused
  // entry so the run keeps going instead of stalling.
  return pool.find((entry) => !excludeIds.has(entry.id)) ?? candidate
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

export const generateOptions = (
  answerId: number,
  streak: number,
  rng: Rng,
  pool: readonly PokemonEntry[] = pokemonList,
): number[] => {
  const answer = getPokemonEntry(answerId)
  const hardTarget = hardDistractorCountForStreak(streak)
  const options = new Set<number>([answerId])

  // Skipped entirely at hardTarget 0 (streak 0-2) so the rng call sequence
  // — and therefore every existing scripted-rng test — is untouched at low
  // streaks.
  if (hardTarget > 0) {
    const hardCandidates = shuffle(
      pool.filter((entry) => entry.id !== answerId && isHardDistractor(answer, entry)),
      rng,
    )
    for (const candidate of hardCandidates) {
      if (options.size >= 1 + hardTarget) break
      options.add(candidate.id)
    }
  }

  let guard = 0
  while (options.size < 4 && guard < 1000) {
    options.add(randomPokemon(rng, pool).id)
    guard += 1
  }
  // A degenerate rng (e.g. one that always returns the same value) can leave
  // the loop above short of 4 unique options even after the guard trips.
  // Deterministically fill any remaining slots so the result is always
  // exactly 4 unique ids.
  let index = 0
  while (options.size < Math.min(4, pool.length)) {
    options.add(pool[index].id)
    index = index >= pool.length - 1 ? 0 : index + 1
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
  // Which generation's Pokémon this run draws from ('all' = every entry), and
  // whether Mega/regional/Gigantamax forms are in scope at all. Together they
  // scope both the draw pool (randomPokemonExcluding/generateOptions) and the
  // win condition (usedIds.size === pool.length), so a generation-scoped run
  // can be "won" without covering the entire national dex. A form's own
  // `generation` (when it was introduced) is used for this, not its base
  // species' — see lib/generations.ts's pokemonPoolFor.
  generation: GenerationFilter
  includeVariants: boolean
  // Whether the most recent correct guess pushed `bestStreak` past what it
  // was before that guess (a genuinely new record, not just tying an
  // existing one). Set on every correct GUESS; a following wrong guess
  // carries it forward unchanged (a wrong guess never raises bestStreak, so
  // it must not flip this back to false) so the run recap can still tell
  // whether the run that just ended set a new best. Reset to false at the
  // start of every run.
  isNewBest: boolean
}

export type GameAction =
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; pokemonId: number }
  | { type: 'NEXT'; rng: Rng }
  | { type: 'HYDRATE_BEST'; bestStreak: number }
  | {
      type: 'HYDRATE_RUN'
      rng: Rng
      streak: number
      usedIds: ReadonlySet<number>
      generation: GenerationFilter
      includeVariants: boolean
    }
  | { type: 'RESTART'; rng: Rng }
  // Starting a fresh run with a (possibly new) generation/includeVariants
  // pick: always resets the streak, since switching pools mid-run would leave
  // usedIds referring to entries that may not even be in the new pool.
  // bestStreak is supplied by the caller (Game.tsx), which is the one that
  // knows how to read the per-generation localStorage key — the reducer
  // stays free of I/O.
  | {
      type: 'SET_GENERATION'
      rng: Rng
      generation: GenerationFilter
      includeVariants: boolean
      bestStreak: number | null
    }

const startRound = (
  rng: Rng,
  streak: number,
  usedIds: ReadonlySet<number>,
  pool: readonly PokemonEntry[],
): Pick<GameState, 'status' | 'pokemonId' | 'options' | 'guess'> => {
  const pokemonId = randomPokemonExcluding(rng, usedIds, pool).id
  return { status: 'loading', pokemonId, options: generateOptions(pokemonId, streak, rng, pool), guess: null }
}

export const createInitialState = (rng: Rng): GameState => {
  const round = startRound(rng, 0, new Set(), pokemonList)
  return {
    ...round,
    streak: 0,
    bestStreak: null,
    roundId: 0,
    usedIds: new Set([round.pokemonId]),
    generation: 'all',
    includeVariants: false,
    isNewBest: false,
  }
}

// A full reset, same shape whether it's triggered by the win screen's "Start
// again", a broken streak's next round, or abandoning an in-progress run from
// the home screen. Keeps the current generation/includeVariants unless told
// otherwise.
const restart = (
  state: GameState,
  rng: Rng,
  generation: GenerationFilter = state.generation,
  includeVariants: boolean = state.includeVariants,
): GameState => {
  const pool = pokemonPoolFor(generation, includeVariants)
  const round = startRound(rng, 0, new Set(), pool)
  return {
    ...state,
    ...round,
    streak: 0,
    usedIds: new Set([round.pokemonId]),
    roundId: state.roundId + 1,
    generation,
    includeVariants,
    isNewBest: false,
  }
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
        isNewBest: correct ? streak > (state.bestStreak ?? 0) : state.isNewBest,
      }
    }

    case 'NEXT': {
      if (state.status === 'won') return restart(state, action.rng)
      const pool = pokemonPoolFor(state.generation, state.includeVariants)
      if (state.streak > 0 && state.usedIds.size === pool.length) {
        // The round just revealed was the last unused entry in the pool.
        return { ...state, status: 'won' }
      }
      const usedIds = state.streak === 0 ? new Set<number>() : state.usedIds
      const round = startRound(action.rng, state.streak, usedIds, pool)
      return { ...state, ...round, usedIds: new Set(usedIds).add(round.pokemonId), roundId: state.roundId + 1 }
    }

    case 'HYDRATE_BEST':
      return { ...state, bestStreak: Math.max(action.bestStreak, state.bestStreak ?? 0) }

    case 'HYDRATE_RUN': {
      // A freshly mounted game already drew a loading round with an empty
      // exclusion set (see createInitialState); nothing to restore for a run
      // that hadn't started yet.
      if (action.streak === 0) return state
      const pool = pokemonPoolFor(action.generation, action.includeVariants)
      if (action.usedIds.size === pool.length) {
        // The stored run had already exhausted the pool; land on the win
        // screen directly rather than drawing a round no distractor pool exists for.
        return {
          ...state,
          streak: action.streak,
          usedIds: action.usedIds,
          status: 'won',
          generation: action.generation,
          includeVariants: action.includeVariants,
          isNewBest: false,
        }
      }
      const round = startRound(action.rng, action.streak, action.usedIds, pool)
      return {
        ...state,
        ...round,
        streak: action.streak,
        usedIds: new Set(action.usedIds).add(round.pokemonId),
        roundId: state.roundId + 1,
        generation: action.generation,
        includeVariants: action.includeVariants,
        isNewBest: false,
      }
    }

    case 'SET_GENERATION': {
      const restarted = restart(state, action.rng, action.generation, action.includeVariants)
      return { ...restarted, bestStreak: action.bestStreak }
    }

    case 'RESTART':
      return restart(state, action.rng)

    default:
      return state
  }
}
