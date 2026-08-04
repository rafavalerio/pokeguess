'use client'

import { ArrowLeft, Home, Trophy } from 'lucide-react'
import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react'

import MainMenu, { type ChallengeRow, type StatsRow } from './MainMenu'
import PokedexShell from './PokedexShell'
import RoundView from './RoundView'
import RunRecap from './RunRecap'
import ScoreBoard from './ScoreBoard'
import ScreenHeader from './ScreenHeader'
import TimeTrialGame from './TimeTrialGame'
import { createInitialState, gameReducer, type Rng } from '@/lib/game'
import {
  GENERATION_SELECT_OPTIONS,
  parseGenerationFilter,
  pokemonPoolFor,
  type GenerationFilter,
} from '@/lib/generations'
import { getPokemonName } from '@/lib/pokemon'
import { isBetterTimeTrialResult, type TimeTrialBest } from '@/lib/timeTrial'
import type { TimeTrialRank } from '@/lib/gameConfig'

const BEST_STREAK_KEY = 'bestStreak'
const STREAK_KEY = 'streak'
const USED_IDS_KEY = 'usedIds'
const SELECTED_GENERATION_KEY = 'selectedGeneration'
const INCLUDE_VARIANTS_KEY = 'includeVariants'
const TIME_TRIAL_BEST_KEY = 'timeTrialBest'
const TIME_TRIAL_ATTEMPTS_KEY = 'timeTrialAttempts'
const rng: Rng = () => Math.random()

// 'all' keeps the pre-existing plain 'bestStreak' key so upgrading doesn't
// lose anyone's saved progress; every other generation gets its own key so
// each has an independent best streak. timeTrialBest/timeTrialAttempts follow
// the exact same convention, kept per generation only (not per
// includeVariants) — see lib/generations.ts's pokemonPoolFor and the
// bestStreak precedent this mirrors.
const bestStreakKey = (generation: GenerationFilter): string =>
  generation === 'all' ? BEST_STREAK_KEY : `${BEST_STREAK_KEY}:gen${generation}`

const timeTrialBestKey = (generation: GenerationFilter): string =>
  generation === 'all' ? TIME_TRIAL_BEST_KEY : `${TIME_TRIAL_BEST_KEY}:gen${generation}`

const timeTrialAttemptsKey = (generation: GenerationFilter): string =>
  generation === 'all' ? TIME_TRIAL_ATTEMPTS_KEY : `${TIME_TRIAL_ATTEMPTS_KEY}:gen${generation}`

// Shared by the game screen's header subtitle and RunRecap's missedGuess
// prop, so the two never describe the active run's pool differently.
const generationLabelFor = (generation: GenerationFilter): string =>
  GENERATION_SELECT_OPTIONS.find((option) => option.value === generation)?.label ?? 'All generations'

// Same amber "new best" treatment RunRecap uses for isNewBest (bg-best/40 +
// border-lamp-amber), since clearing every Pokémon in the pool is always at
// least as notable as a new streak record.
const WinScreen = ({ streak }: { streak: number }) => (
  <div className="bg-best/40 border-lamp-amber mb-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 px-6 py-16 text-center">
    <Trophy className="text-best-ink size-10" aria-hidden="true" />
    <p className="text-best-ink text-base font-semibold">You caught &apos;em all!</p>
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
  // Navigation between the main menu, its stats/challenges views, Full Dex
  // Play, and Time Trial. Deliberately plain state rather than part of
  // GameState: it's screen routing, not round logic, and 'menu' on both
  // server and client renders the same way, so it carries none of the
  // hydration risk state.pokemonId and state.options do.
  const [view, setView] = useState<'menu' | 'stats' | 'game' | 'timeTrial' | 'challenges'>('menu')
  // The menu's generation picker. Plain state like `view`, not part of
  // GameState: it's the pre-game pick, only "committed" into the reducer (via
  // SET_GENERATION) when a fresh Full Dex run actually starts — see
  // startRun below. Time Trial reads it directly as a prop instead, since a
  // trial never touches the Full Dex reducer at all. Defaults to 'all' on
  // both server and client, so it carries none of the hydration risk
  // state.pokemonId/state.options do.
  const [selectedGeneration, setSelectedGeneration] = useState<GenerationFilter>('all')
  // Whether Mega/regional/Gigantamax forms are in the draw pool, alongside
  // `selectedGeneration` — same "pre-game pick" pattern, same default-false
  // on both server and client. Independent of the generation pick since a
  // form's own generation (when it was introduced) can differ from its base
  // species' — see lib/generations.ts's pokemonPoolFor.
  const [includeVariants, setIncludeVariants] = useState(false)
  // Best streak per generation ('all' included), read from localStorage for
  // the stats screen. Keyed by String(GenerationFilter) since object keys are
  // always strings.
  const [allBestStreaks, setAllBestStreaks] = useState<Record<string, number>>({})
  // Time Trial's personal best + attempt count per generation, read from
  // localStorage for the Challenges screen and passed into TimeTrialGame so
  // it can tell whether a just-finished trial set a new record.
  const [challengesData, setChallengesData] = useState<Record<string, { best: TimeTrialBest | null; attempts: number }>>(
    {},
  )

  useEffect(() => {
    try {
      const hydratedGeneration = parseGenerationFilter(localStorage.getItem(SELECTED_GENERATION_KEY))
      setSelectedGeneration(hydratedGeneration)
      const hydratedIncludeVariants = localStorage.getItem(INCLUDE_VARIANTS_KEY) === 'true'
      setIncludeVariants(hydratedIncludeVariants)

      const bestStreaks: Record<string, number> = {}
      for (const option of GENERATION_SELECT_OPTIONS) {
        const stored = Number(localStorage.getItem(bestStreakKey(option.value)))
        if (Number.isFinite(stored) && stored > 0) bestStreaks[String(option.value)] = Math.floor(stored)
      }
      setAllBestStreaks(bestStreaks)

      const hydratedBest = bestStreaks[String(hydratedGeneration)]
      if (hydratedBest !== undefined) {
        dispatch({ type: 'HYDRATE_BEST', bestStreak: hydratedBest })
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
        dispatch({
          type: 'HYDRATE_RUN',
          rng,
          streak: Math.floor(storedStreak),
          usedIds: new Set(storedUsedIds),
          generation: hydratedGeneration,
          includeVariants: hydratedIncludeVariants,
        })
      }
    } catch {
      // localStorage can throw (e.g. SecurityError when site data is
      // blocked), or the stored usedIds can fail to parse; the game is still
      // playable without a restored run.
    }
  }, [])

  // Reads every generation's Time Trial personal best + attempt count, kept
  // as its own effect (separate from the Full Dex hydration above) since it's
  // an unrelated concern with its own best-effort try/catch.
  useEffect(() => {
    try {
      const challenges: Record<string, { best: TimeTrialBest | null; attempts: number }> = {}
      for (const option of GENERATION_SELECT_OPTIONS) {
        const attemptsRaw = Number(localStorage.getItem(timeTrialAttemptsKey(option.value)))
        const attempts = Number.isFinite(attemptsRaw) && attemptsRaw > 0 ? Math.floor(attemptsRaw) : 0

        let best: TimeTrialBest | null = null
        const storedBest: unknown = JSON.parse(localStorage.getItem(timeTrialBestKey(option.value)) ?? 'null')
        if (
          storedBest !== null &&
          typeof storedBest === 'object' &&
          'rank' in storedBest &&
          'elapsedMs' in storedBest &&
          'correct' in storedBest
        ) {
          best = storedBest as TimeTrialBest
        }
        challenges[String(option.value)] = { best, attempts }
      }
      setChallengesData(challenges)
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [])

  useEffect(() => {
    if (state.bestStreak !== null) {
      try {
        localStorage.setItem(bestStreakKey(state.generation), String(state.bestStreak))
        setAllBestStreaks((prev) => ({ ...prev, [String(state.generation)]: state.bestStreak as number }))
      } catch {
        // See the read effect above: persistence is best-effort.
      }
    }
  }, [state.bestStreak, state.generation])

  useEffect(() => {
    try {
      localStorage.setItem(STREAK_KEY, String(state.streak))
      localStorage.setItem(USED_IDS_KEY, JSON.stringify([...state.usedIds]))
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [state.streak, state.usedIds])

  // Persisted on every pick (not just when a run starts) so a refresh before
  // clicking Full Dex/Time Trial remembers it, and so HYDRATE_RUN above can
  // tell which pool a restored run was drawn from — the dropdown is locked
  // (see MainMenu) whenever a run is in progress, so this key always matches
  // the active run's generation once one exists.
  const handleGenerationChange = useCallback((generation: GenerationFilter) => {
    setSelectedGeneration(generation)
    try {
      localStorage.setItem(SELECTED_GENERATION_KEY, String(generation))
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [])

  const handleIncludeVariantsChange = useCallback((next: boolean) => {
    setIncludeVariants(next)
    try {
      localStorage.setItem(INCLUDE_VARIANTS_KEY, String(next))
    } catch {
      // See the read effect above: persistence is best-effort.
    }
  }, [])

  const startRun = useCallback(
    (generation: GenerationFilter, includeVariantsPick: boolean) => {
      dispatch({
        type: 'SET_GENERATION',
        rng,
        generation,
        includeVariants: includeVariantsPick,
        bestStreak: allBestStreaks[String(generation)] ?? null,
      })
      setView('game')
    },
    [allBestStreaks],
  )

  // Reported once by TimeTrialGame when a trial finishes. Compares against
  // the stored personal best, writes if it's better, always increments the
  // attempts counter, and updates challengesData so the Challenges screen
  // reflects the new result immediately without a reload.
  //
  // The localStorage writes happen here, in the callback body, computed from
  // `challengesData` directly (a dependency of this callback, so it's never
  // stale) — not inside the setChallengesData updater below. React may
  // invoke a state updater more than once per commit (e.g. under
  // StrictMode, which next.config.mjs enables via reactStrictMode), and an
  // updater is expected to be a pure function of its previous state with no
  // side effects. The updater here only computes and returns the next
  // state; every side effect happens exactly once, before it's called.
  const handleTimeTrialFinish = useCallback(
    (result: { generation: GenerationFilter; correct: number; elapsedMs: number; rank: TimeTrialRank }) => {
      const key = String(result.generation)
      const candidate: TimeTrialBest = { rank: result.rank, elapsedMs: result.elapsedMs, correct: result.correct }
      const current = challengesData[key] ?? { best: null, attempts: 0 }
      const best = isBetterTimeTrialResult(candidate, current.best) ? candidate : current.best
      const attempts = current.attempts + 1
      try {
        localStorage.setItem(timeTrialBestKey(result.generation), JSON.stringify(best))
        localStorage.setItem(timeTrialAttemptsKey(result.generation), String(attempts))
      } catch {
        // See the read effect above: persistence is best-effort.
      }
      setChallengesData((prev) => ({ ...prev, [key]: { best, attempts } }))
    },
    [challengesData],
  )

  // total is the base-species pool size (includeVariants: false) regardless
  // of which pool a given run was actually played with — bestStreak is
  // tracked per generation only, not per includeVariants (see
  // lib/generations.ts's pokemonPoolFor), so the base pool is the one stable
  // denominator every row can compare against.
  const statsRows: StatsRow[] = GENERATION_SELECT_OPTIONS.map((option) => ({
    key: String(option.value),
    label: option.label,
    value: allBestStreaks[String(option.value)] ?? null,
    total: pokemonPoolFor(option.value, false).length,
  }))

  const challengesRows: ChallengeRow[] = GENERATION_SELECT_OPTIONS.map((option) => ({
    key: String(option.value),
    label: option.label,
    best: challengesData[String(option.value)]?.best ?? null,
    attempts: challengesData[String(option.value)]?.attempts ?? 0,
  }))

  const handleReady = useCallback(() => dispatch({ type: 'IMAGE_READY' }), [])
  const revealed = mounted && state.status === 'revealed'
  const won = mounted && state.status === 'won'
  const canAdvance = revealed || won

  // Drives the run-recap screen (see RunRecap) in place of the normal round
  // UI once a wrong guess ends the run. Computed as one value, rather than a
  // separate boolean plus re-reading state.guess at the render site, so
  // TypeScript narrows state.guess (number | null) to number here instead of
  // needing a second null check (or a cast) in the JSX below — revealed with
  // a set guess only ever follows a real GUESS action, so guess is never
  // actually null at this point.
  const missedGuess =
    revealed && state.guess !== null && state.guess !== state.pokemonId
      ? {
          correctEntries: [...state.usedIds]
            .filter((id) => id !== state.pokemonId)
            .map((id) => ({ id, name: getPokemonName(id) })),
          bestStreak: state.bestStreak,
          isNewBest: state.isNewBest,
          missedAnswer: { id: state.pokemonId, name: getPokemonName(state.pokemonId) },
          guessedAnswer: { id: state.guess, name: getPokemonName(state.guess) },
        }
      : null

  // Digits 1-4 mirror clicking an option (matching the on-screen number
  // badges), Space or N mirrors the Next/Start again/Main menu button.
  // Modifier keys are left alone so this doesn't fight browser shortcuts like
  // Cmd+1 for tab switching. Scoped to the 'game' view only — Time Trial has
  // its own auto-advance flow with no equivalent shortcuts.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (view !== 'game' || event.metaKey || event.ctrlKey || event.altKey) return

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
          // The win screen's button navigates to the main menu rather than
          // restarting in place — see the button below — so the shortcut
          // that mirrors it does the same instead of dispatching NEXT.
          if (state.status === 'won') {
            setView('menu')
          } else {
            dispatch({ type: 'NEXT', rng })
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, state.status, state.options, state.guess, state.pokemonId])

  if (view === 'game') {
    return (
      <PokedexShell cornerAction={{ icon: Home, label: 'Home', onClick: () => setView('menu') }}>
        {/* The title only appears on the main menu; this is the game screen's
            own heading, with the active run's generation as its subtitle —
            same ScreenHeader used everywhere else, so the two never drift into
            different typography. */}
        <div className="mb-3">
          <ScreenHeader title="Who's that Pokémon?" subtitle={generationLabelFor(state.generation)} size="small" />
        </div>

        {/* Hidden once a run ends on a wrong guess: ScoreBoard's live "Streak"
            already reads 0 by this point (GUESS zeroes it immediately), and
            RunRecap shows both numbers itself — showing both would read as a
            contradiction. Also hidden on the win screen, which shows its own
            "Final streak" — repeating Streak/Best right above it would be the
            same numbers twice on one screen. */}
        {!missedGuess && !won && (
          <div className="mb-4">
            <ScoreBoard streak={state.streak} bestStreak={state.bestStreak} />
          </div>
        )}

        {won ? (
          <WinScreen streak={state.streak} />
        ) : missedGuess ? (
          <RunRecap {...missedGuess} />
        ) : (
          <RoundView
            mounted={mounted}
            pokemonId={state.pokemonId}
            roundId={state.roundId}
            status={state.status}
            options={state.options}
            guess={state.guess}
            onReady={handleReady}
            onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId })}
          />
        )}

        <button
          type="button"
          onClick={() => (won ? setView('menu') : dispatch({ type: 'NEXT', rng }))}
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
          {won ? 'Main menu' : missedGuess ? 'Start again' : 'Next'}
        </button>
      </PokedexShell>
    )
  }

  if (view === 'timeTrial') {
    return (
      <PokedexShell cornerAction={{ icon: Home, label: 'Home', onClick: () => setView('menu') }}>
        <div className="mb-3">
          <ScreenHeader title="Time Trial" subtitle={generationLabelFor(selectedGeneration)} size="small" />
        </div>
        <TimeTrialGame
          generation={selectedGeneration}
          includeVariants={includeVariants}
          personalBest={challengesData[String(selectedGeneration)]?.best ?? null}
          onFinish={handleTimeTrialFinish}
          onExit={() => setView('menu')}
        />
      </PokedexShell>
    )
  }

  return (
    <PokedexShell
      cornerAction={
        view === 'stats' || view === 'challenges'
          ? { icon: ArrowLeft, label: 'Back', onClick: () => setView('menu') }
          : undefined
      }
    >
      <MainMenu
        mode={view}
        statsRows={statsRows}
        challengesRows={challengesRows}
        canContinue={state.streak > 0}
        streak={state.streak}
        generation={selectedGeneration}
        generationOptions={GENERATION_SELECT_OPTIONS}
        onGenerationChange={handleGenerationChange}
        includeVariants={includeVariants}
        onIncludeVariantsChange={handleIncludeVariantsChange}
        onPlayFullDex={() => startRun(selectedGeneration, includeVariants)}
        onPlayTimeTrial={() => setView('timeTrial')}
        onContinue={() => setView('game')}
        onStartAgain={() => dispatch({ type: 'RESTART', rng })}
        onShowStats={() => setView('stats')}
        onShowChallenges={() => setView('challenges')}
      />
    </PokedexShell>
  )
}

export default Game
