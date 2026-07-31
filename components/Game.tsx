'use client'

import { useCallback, useEffect, useReducer, useSyncExternalStore } from 'react'

import { guessButtonClassName } from './GuessButton'
import GuessGrid from './GuessGrid'
import PokedexShell from './PokedexShell'
import PokemonSilhouette from './PokemonSilhouette'
import ScoreBoard from './ScoreBoard'
import { createInitialState, gameReducer, type Rng } from '@/lib/game'
import { getPokemonName, getSpeciesDex } from '@/lib/pokemon'

const BEST_STREAK_KEY = 'bestStreak'
const STREAK_KEY = 'streak'
const USED_IDS_KEY = 'usedIds'
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
  <div className="flex flex-col gap-2">
    {[0, 1, 2, 3].map((slot) => (
      // These skeletons are disabled and unlabelled on purpose: they exist to
      // hold the slot's footprint until the real options arrive. Labelling them
      // would announce four fake options that cannot be pressed.
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label
      <button key={slot} type="button" disabled className={guessButtonClassName('idle')}>
        <span className="hidden size-5 shrink-0 sm:block" />
        <span className="flex h-5 items-center">
          <span className="bg-screen-sunk block h-2.5 w-16 animate-pulse rounded-full" />
        </span>
      </button>
    ))}
  </div>
)

// Deliberately minimal — a placeholder to replace once the win screen gets
// its own design pass.
const WinScreen = ({ streak }: { streak: number }) => (
  <div className="bg-screen-sunk mb-3 flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center">
    <p className="text-ink text-base font-semibold">You&apos;ve named every Pokémon!</p>
    <p className="text-ink-soft text-sm">Final streak: {streak}</p>
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
      const storedBest = Number(localStorage.getItem(BEST_STREAK_KEY))
      if (Number.isFinite(storedBest) && storedBest > 0) {
        dispatch({ type: 'HYDRATE_BEST', bestStreak: Math.floor(storedBest) })
      }

      const storedStreak = Number(localStorage.getItem(STREAK_KEY))
      const storedUsedIds: unknown = JSON.parse(localStorage.getItem(USED_IDS_KEY) ?? '[]')
      if (
        Number.isFinite(storedStreak) &&
        storedStreak > 0 &&
        Array.isArray(storedUsedIds) &&
        storedUsedIds.length > 0 &&
        storedUsedIds.every((id) => typeof id === 'number')
      ) {
        dispatch({ type: 'HYDRATE_RUN', rng, streak: Math.floor(storedStreak), usedIds: new Set(storedUsedIds) })
      }
    } catch {
      // localStorage can throw (e.g. SecurityError when site data is
      // blocked), or the stored usedIds can fail to parse; the game is still
      // playable without a restored run.
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

  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, String(state.streak))
      localStorage.setItem(USED_IDS_KEY, JSON.stringify([...state.usedIds]))
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [state.streak, state.usedIds])

  const handleReady = useCallback(() => dispatch({ type: 'IMAGE_READY' }), [])
  const revealed = mounted && state.status === 'revealed'
  const won = mounted && state.status === 'won'
  const canAdvance = revealed || won

  // Digits 1-4 mirror clicking an option (matching the on-screen number
  // badges), Space or N mirrors the Next/Start again button. Modifier keys
  // are left alone so this doesn't fight browser shortcuts like Cmd+1 for
  // tab switching.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (state.status === 'guessing') {
        const index = Number(event.key) - 1
        if (index < 0 || index > 3) return
        const pokemonId = state.options[index]
        if (pokemonId === undefined) return
        dispatch({ type: 'GUESS', pokemonId })
        return
      }

      if (state.status === 'revealed' || state.status === 'won') {
        const isNext = state.status === 'revealed' && state.guess === state.pokemonId
        if (event.key === ' ' || (isNext && event.key.toLowerCase() === 'n')) {
          event.preventDefault()
          dispatch({ type: 'NEXT', rng })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.status, state.options, state.guess, state.pokemonId])

  return (
    <PokedexShell>
      {/*
        Onest's geometric letterforms carry a lot of sidebearing at display
        sizes, so the title takes negative tracking to keep it feeling like one
        word rather than spaced-out capitals.
      */}
      <h1 className="text-ink mb-1 text-center text-xl font-bold tracking-tight">Pokéguess</h1>
      <p className="text-ink-soft mb-3 text-center text-xs">Who&apos;s that Pokémon?</p>

      <div className="mb-4">
        <ScoreBoard streak={state.streak} bestStreak={state.bestStreak} />
      </div>

      {won ? (
        <WinScreen streak={state.streak} />
      ) : (
        <>
          <div className="mb-3">
            {mounted ? (
              <PokemonSilhouette
                pokemonId={state.pokemonId}
                roundId={state.roundId}
                status={state.status}
                onReady={handleReady}
              />
            ) : (
              <SilhouettePlaceholder />
            )}
          </div>

          <p className="text-ink mb-4 h-6 text-center text-sm font-semibold tabular-nums">
            {revealed ? `#${getSpeciesDex(state.pokemonId)} · ${getPokemonName(state.pokemonId)}` : ' '}
          </p>

          {mounted && state.status !== 'loading' ? (
            <GuessGrid
              options={state.options}
              answer={state.pokemonId}
              guess={state.guess}
              revealed={revealed}
              disabled={state.status !== 'guessing'}
              onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId })}
            />
          ) : (
            <GuessGridPlaceholder />
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => dispatch({ type: 'NEXT', rng })}
        disabled={!canAdvance}
        className="bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark mt-4 flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99] disabled:cursor-default disabled:opacity-40"
      >
        {/* The Space-bar hint mirrors the guess grid's number badges: same
            bordered box, same "only visible while the shortcut works" rule
            (revealed or won, sm and up), just with an underscore standing in
            for the spacebar. */}
        {canAdvance && (
          <span
            aria-hidden="true"
            className="text-button/40 hidden size-5 shrink-0 items-center justify-center rounded border border-current/40 text-xs font-semibold sm:flex"
          >
            _
          </span>
        )}
        {won || (revealed && state.guess !== state.pokemonId) ? 'Start again' : 'Next'}
      </button>
    </PokedexShell>
  )
}

export default Game
