'use client'

import { useCallback, useEffect, useReducer } from 'react'

import GuessGrid from './GuessGrid'
import PokedexShell from './PokedexShell'
import PokemonSilhouette from './PokemonSilhouette'
import ScoreBoard from './ScoreBoard'
import { createInitialState, gameReducer, type Rng } from '@/lib/game'
import { getPokemonName } from '@/lib/pokemon'

const BEST_STREAK_KEY = 'bestStreak'
const rng: Rng = () => Math.random()

const Game = () => {
  const [state, dispatch] = useReducer(gameReducer, rng, createInitialState)

  useEffect(() => {
    const stored = Number(localStorage.getItem(BEST_STREAK_KEY))
    if (Number.isFinite(stored) && stored > 0) {
      dispatch({ type: 'HYDRATE_BEST', bestStreak: stored })
    }
  }, [])

  useEffect(() => {
    if (state.bestStreak !== null) {
      localStorage.setItem(BEST_STREAK_KEY, String(state.bestStreak))
    }
  }, [state.bestStreak])

  const handleReady = useCallback(() => dispatch({ type: 'IMAGE_READY' }), [])
  const revealed = state.status === 'revealed'

  return (
    <PokedexShell>
      <h1 className="text-ink mb-1 text-center text-lg font-medium">Pokéguess</h1>
      <p className="text-ink-soft mb-3 text-center text-xs">Who&apos;s that Pokémon?</p>

      <div className="mb-4">
        <ScoreBoard streak={state.streak} bestStreak={state.bestStreak} />
      </div>

      <div className="mb-3">
        <PokemonSilhouette dex={state.dex} revealed={revealed} onReady={handleReady} />
      </div>

      <p className="text-ink mb-4 h-6 text-center text-sm font-medium">
        {revealed ? `#${state.dex} · ${getPokemonName(state.dex)}` : ' '}
      </p>

      <GuessGrid
        options={state.options}
        answer={state.dex}
        guess={state.guess}
        revealed={revealed}
        onGuess={(dex) => dispatch({ type: 'GUESS', dex })}
      />

      <button
        type="button"
        onClick={() => dispatch({ type: 'NEXT', rng })}
        disabled={!revealed}
        className="bg-shell focus-visible:ring-shell mt-4 w-full rounded-lg py-2.5 text-sm font-medium text-white transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
      >
        Next
      </button>
    </PokedexShell>
  )
}

export default Game
