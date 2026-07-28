export const MIN_DEX = 1
export const MAX_DEX = 905

export type Rng = () => number

export const randomDex = (rng: Rng): number =>
  MIN_DEX + Math.floor(rng() * (MAX_DEX - MIN_DEX + 1))

const shuffle = <T,>(items: T[], rng: Rng): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export const generateOptions = (answer: number, rng: Rng): number[] => {
  const options = new Set<number>([answer])
  let guard = 0
  while (options.size < 4 && guard < 1000) {
    options.add(randomDex(rng))
    guard += 1
  }
  // A degenerate rng (e.g. one that always returns the same value) can leave
  // the loop above short of 4 unique options even after the guard trips.
  // Deterministically fill any remaining slots so the result is always
  // exactly 4 unique dex numbers.
  let candidate = MIN_DEX
  while (options.size < 4) {
    options.add(candidate)
    candidate = candidate >= MAX_DEX ? MIN_DEX : candidate + 1
  }
  return shuffle([...options], rng)
}

export type Status = 'loading' | 'guessing' | 'revealed'

export type GameState = {
  status: Status
  dex: number
  options: number[]
  guess: number | null
  streak: number
  bestStreak: number | null
  // Monotonically incrementing per round. A repeat dex draw (roughly 1 in
  // MAX_DEX chance) leaves `dex` unchanged across NEXT, which would otherwise
  // give consuming components (PokemonSilhouette) no signal that a new round
  // started. `roundId` always changes on NEXT regardless of which dex was
  // drawn, so it — not `dex` — is the correct thing to key a fresh element on.
  roundId: number
}

export type GameAction =
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; dex: number }
  | { type: 'NEXT'; rng: Rng }
  | { type: 'HYDRATE_BEST'; bestStreak: number }

const startRound = (rng: Rng): Pick<GameState, 'status' | 'dex' | 'options' | 'guess'> => {
  const dex = randomDex(rng)
  return { status: 'loading', dex, options: generateOptions(dex, rng), guess: null }
}

export const createInitialState = (rng: Rng): GameState => ({
  ...startRound(rng),
  streak: 0,
  bestStreak: null,
  roundId: 0,
})

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'IMAGE_READY':
      return state.status === 'loading' ? { ...state, status: 'guessing' } : state

    case 'GUESS': {
      if (state.status !== 'guessing') return state
      const correct = action.dex === state.dex
      const streak = correct ? state.streak + 1 : 0
      return {
        ...state,
        status: 'revealed',
        guess: action.dex,
        streak,
        bestStreak: Math.max(streak, state.bestStreak ?? 0),
      }
    }

    case 'NEXT':
      return { ...state, ...startRound(action.rng), roundId: state.roundId + 1 }

    case 'HYDRATE_BEST':
      return { ...state, bestStreak: Math.max(action.bestStreak, state.bestStreak ?? 0) }

    default:
      return state
  }
}
