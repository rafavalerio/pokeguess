'use client'

import { useCallback, useEffect, useReducer, useSyncExternalStore } from 'react'

import { guessButtonClassName } from './GuessButton'
import GuessGrid from './GuessGrid'
import PokedexShell from './PokedexShell'
import PokemonSilhouette from './PokemonSilhouette'
import ScoreBoard from './ScoreBoard'
import { createInitialState, gameReducer, type Rng } from '@/lib/game'
import { getPokemonName } from '@/lib/pokemon'

const BEST_STREAK_KEY = 'bestStreak'
const rng: Rng = () => Math.random()

// createInitialState draws from Math.random, so the state it produces
// necessarily differs between the server render and the client's first
// render. Nothing derived from that random state (the silhouette, the
// revealed name, the guess grid) may be rendered until after mount, or
// hydration will fail with a text/attribute mismatch. These placeholders
// reserve the exact same footprint so there is no layout shift once the
// real, client-only content swaps in.
const SilhouettePlaceholder = () => (
  <div className="bg-screen-sunk mx-auto flex size-48 items-center justify-center rounded-full sm:size-56" />
)

// Each slot holds a skeleton bar rather than sitting empty: four blank boxes
// read as broken, where a bar reads as "not ready yet". The bar sits inside
// the same button box, so the slot keeps the exact height of the loaded state.
const GuessGridPlaceholder = () => (
  <div className="grid grid-cols-2 gap-2">
    {[0, 1, 2, 3].map((slot) => (
      <button key={slot} type="button" disabled className={guessButtonClassName('idle')}>
        <span className="flex h-5 items-center">
          <span className="bg-screen-sunk block h-2.5 w-16 animate-pulse rounded-full" />
        </span>
      </button>
    ))}
  </div>
)

const emptySubscribe = () => () => {}

// SSR-safe mount detection: the server snapshot is always `false`, and the
// client snapshot is always `true`, so this reads `false` on the server and
// on the client's very first (hydrating) render, then flips to `true` once
// React commits on the client — without calling setState from an effect.
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false)

const Game = () => {
  const [state, dispatch] = useReducer(gameReducer, rng, createInitialState)
  const mounted = useMounted()

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(BEST_STREAK_KEY))
      if (Number.isFinite(stored) && stored > 0) {
        dispatch({ type: 'HYDRATE_BEST', bestStreak: Math.floor(stored) })
      }
    } catch {
      // localStorage can throw (e.g. SecurityError when site data is
      // blocked); the game is still playable without a persisted best streak.
    }
  }, [])

  useEffect(() => {
    if (state.bestStreak !== null) {
      try {
        localStorage.setItem(BEST_STREAK_KEY, String(state.bestStreak))
      } catch {
        // See the read effect above: persistence is best-effort.
      }
    }
  }, [state.bestStreak])

  const handleReady = useCallback(() => dispatch({ type: 'IMAGE_READY' }), [])
  const revealed = mounted && state.status === 'revealed'

  return (
    <PokedexShell>
      <h1 className="text-ink mb-1 text-center text-lg font-medium">Pokéguess</h1>
      <p className="text-ink-soft mb-3 text-center text-xs">Who&apos;s that Pokémon?</p>

      <div className="mb-4">
        <ScoreBoard streak={state.streak} bestStreak={state.bestStreak} />
      </div>

      <div className="mb-3">
        {mounted ? (
          <PokemonSilhouette
            dex={state.dex}
            roundId={state.roundId}
            status={state.status}
            onReady={handleReady}
          />
        ) : (
          <SilhouettePlaceholder />
        )}
      </div>

      <p className="text-ink mb-4 h-6 text-center text-sm font-medium">
        {revealed ? `#${state.dex} · ${getPokemonName(state.dex)}` : ' '}
      </p>

      {mounted && state.status !== 'loading' ? (
        <GuessGrid
          options={state.options}
          answer={state.dex}
          guess={state.guess}
          revealed={revealed}
          disabled={state.status !== 'guessing'}
          onGuess={(dex) => dispatch({ type: 'GUESS', dex })}
        />
      ) : (
        <GuessGridPlaceholder />
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: 'NEXT', rng })}
        disabled={!revealed}
        className="bg-shell focus-visible:ring-shell mt-4 w-full rounded-lg py-2.5 text-sm font-medium text-button transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
      >
        {revealed && state.guess !== state.dex ? 'Start again' : 'Next'}
      </button>
    </PokedexShell>
  )
}

export default Game
