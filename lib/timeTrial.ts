import { randomPokemonExcluding, generateOptionsWithHardTarget, type Rng } from './game'
import { pokemonPoolFor, type GenerationFilter } from './generations'
import { TIME_TRIAL_HARD_DISTRACTORS, TIME_TRIAL_ROUND_COUNT, type TimeTrialRank } from './gameConfig'
import type { PokemonEntry } from './pokemonData'

export type { Rng } from './game'

export type TimeTrialStatus = 'preparing' | 'loading' | 'guessing' | 'revealed' | 'finished'

export type TimeTrialRound = { pokemonId: number; options: number[] }

export type TimeTrialResult = { pokemonId: number; guess: number; correct: boolean }

// What's persisted to localStorage as a generation's personal best — see
// components/Game.tsx's timeTrialBestKey.
export type TimeTrialBest = { rank: TimeTrialRank; elapsedMs: number; correct: number }

export type TimeTrialState = {
  status: TimeTrialStatus
  rounds: TimeTrialRound[] // all TIME_TRIAL_ROUND_COUNT rounds, drawn once at START
  roundIndex: number
  guess: number | null
  // Same purpose as GameState.roundId (see lib/game.ts): always changes when
  // a new round is presented, so PokemonSilhouette's <img> reliably remounts
  // and fires a fresh load event even on the vanishingly unlikely repeat draw.
  roundId: number
  results: TimeTrialResult[] // completed rounds, oldest first
  generation: GenerationFilter
  includeVariants: boolean
  // Set once sprite preloading resolves and round 1 is actually presented —
  // not at trial creation — so the preload wait itself is never counted
  // against the player's time. See components/TimeTrialGame.tsx.
  startedAt: number | null
  // Set the instant the final round's GUESS is dispatched, not after that
  // round's reveal pause — the auto-advance delay never counts against the
  // score either.
  finishedAt: number | null
}

export type TimeTrialAction =
  | { type: 'START'; rng: Rng; generation: GenerationFilter; includeVariants: boolean }
  | { type: 'PRELOADED'; now: number }
  | { type: 'IMAGE_READY' }
  | { type: 'GUESS'; pokemonId: number; now: number }
  | { type: 'ADVANCE' }

const drawTimeTrialRounds = (rng: Rng, pool: readonly PokemonEntry[]): TimeTrialRound[] => {
  const usedIds = new Set<number>()
  const rounds: TimeTrialRound[] = []
  for (let i = 0; i < TIME_TRIAL_ROUND_COUNT; i += 1) {
    const pokemonId = randomPokemonExcluding(rng, usedIds, pool).id
    usedIds.add(pokemonId)
    rounds.push({
      pokemonId,
      options: generateOptionsWithHardTarget(pokemonId, TIME_TRIAL_HARD_DISTRACTORS, rng, pool),
    })
  }
  return rounds
}

const startTimeTrialState = (rng: Rng, generation: GenerationFilter, includeVariants: boolean): TimeTrialState => {
  const pool = pokemonPoolFor(generation, includeVariants)
  return {
    status: 'preparing',
    rounds: drawTimeTrialRounds(rng, pool),
    roundIndex: 0,
    guess: null,
    roundId: 0,
    results: [],
    generation,
    includeVariants,
    startedAt: null,
    finishedAt: null,
  }
}

export const createInitialTimeTrialState = (
  rng: Rng,
  generation: GenerationFilter,
  includeVariants: boolean,
): TimeTrialState => startTimeTrialState(rng, generation, includeVariants)

export const timeTrialReducer = (state: TimeTrialState, action: TimeTrialAction): TimeTrialState => {
  switch (action.type) {
    case 'START':
      return startTimeTrialState(action.rng, action.generation, action.includeVariants)

    case 'PRELOADED':
      return state.status === 'preparing' ? { ...state, status: 'loading', startedAt: action.now } : state

    case 'IMAGE_READY':
      return state.status === 'loading' ? { ...state, status: 'guessing' } : state

    case 'GUESS': {
      if (state.status !== 'guessing') return state
      const round = state.rounds[state.roundIndex]
      const correct = action.pokemonId === round.pokemonId
      const isLastRound = state.roundIndex === state.rounds.length - 1
      return {
        ...state,
        status: 'revealed',
        guess: action.pokemonId,
        results: [...state.results, { pokemonId: round.pokemonId, guess: action.pokemonId, correct }],
        finishedAt: isLastRound ? action.now : state.finishedAt,
      }
    }

    case 'ADVANCE': {
      if (state.status !== 'revealed') return state
      const isLastRound = state.roundIndex === state.rounds.length - 1
      if (isLastRound) return { ...state, status: 'finished' }
      return { ...state, status: 'loading', roundIndex: state.roundIndex + 1, guess: null, roundId: state.roundId + 1 }
    }

    default:
      return state
  }
}

export const formatElapsedMs = (ms: number): string => {
  const totalTenths = Math.floor(ms / 100)
  const seconds = Math.floor(totalTenths / 10)
  const tenths = totalTenths % 10
  const minutes = Math.floor(seconds / 60)
  const remainderSeconds = seconds % 60
  return `${minutes}:${String(remainderSeconds).padStart(2, '0')}.${tenths}`
}

const RANK_ORDER: readonly TimeTrialRank[] = ['D', 'C', 'B', 'A', 'S']

// Rank first, elapsed time as the tiebreaker within the same rank — matches
// how personal bests are compared for the Challenges screen.
export const isBetterTimeTrialResult = (candidate: TimeTrialBest, current: TimeTrialBest | null): boolean => {
  if (!current) return true
  const candidateRank = RANK_ORDER.indexOf(candidate.rank)
  const currentRank = RANK_ORDER.indexOf(current.rank)
  return candidateRank !== currentRank ? candidateRank > currentRank : candidate.elapsedMs < current.elapsedMs
}
