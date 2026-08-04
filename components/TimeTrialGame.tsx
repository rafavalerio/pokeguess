'use client'

import Image from 'next/image'
import { useEffect, useReducer, useState } from 'react'

import RoundView from './RoundView'
import TimeTrialProgress from './TimeTrialProgress'
import TimeTrialResults from './TimeTrialResults'
import {
  rankTimeTrial,
  TIME_TRIAL_PRELOAD_FALLBACK_MS,
  TIME_TRIAL_REVEAL_MS,
  type TimeTrialRank,
} from '@/lib/gameConfig'
import type { GenerationFilter } from '@/lib/generations'
import { getSpriteUrl } from '@/lib/pokemon'
import {
  createInitialTimeTrialState,
  isBetterTimeTrialResult,
  timeTrialReducer,
  type Rng,
  type TimeTrialBest,
} from '@/lib/timeTrial'

const rng: Rng = () => Math.random()

type FinishPayload = { generation: GenerationFilter; correct: number; elapsedMs: number; rank: TimeTrialRank }

type Props = {
  generation: GenerationFilter
  includeVariants: boolean
  // The generation's current personal best, if any — used to decide whether
  // this trial's result counts as a new one. Game.tsx owns the actual
  // localStorage read/write; this component only compares.
  personalBest: TimeTrialBest | null
  onFinish: (result: FinishPayload) => void
  onExit: () => void
}

// Sized to roughly match the round UI's footprint, though an exact match
// isn't required here — PokedexShell's ResizeObserver-driven height
// transition (see components/PokedexShell.tsx) already smooths over content
// height changes between views.
const Preparing = () => (
  <div className="bg-screen-sunk flex h-64 flex-col items-center justify-center gap-3 rounded-2xl">
    <Image
      src="/images/pokeball.png"
      alt=""
      aria-hidden="true"
      width={40}
      height={40}
      className="animate-pokeball-spin size-10"
    />
    <p className="text-ink-soft text-sm font-medium">Preparing your trial…</p>
  </div>
)

const TimeTrialGame = ({ generation, includeVariants, personalBest, onFinish, onExit }: Props) => {
  const [state, dispatch] = useReducer(timeTrialReducer, undefined, () =>
    createInitialTimeTrialState(rng, generation, includeVariants),
  )
  // Drives the ticking clock display; the reducer's own startedAt/finishedAt
  // stay the source of truth for the score itself (see lib/timeTrial.ts).
  const [displayNow, setDisplayNow] = useState<number>(() => Date.now())
  // Snapshotted once, inside the report-once effect below, against
  // `personalBest` as it reads AT THAT MOMENT (the old best, before
  // onFinish's result flows back down). Recomputing isNewBest live in the
  // 'finished' render branch from the (prop) personalBest would break the
  // instant onFinish's parent update lands: Game.tsx's handleTimeTrialFinish
  // writes this very result as the new personalBest, so a live
  // isBetterTimeTrialResult(candidate, candidate) then compares the result
  // against itself and returns false — the banner would flash true for one
  // render, then vanish.
  const [finishedIsNewBest, setFinishedIsNewBest] = useState(false)

  // Preloads every answer sprite before round 1 is shown, so no player's
  // score is skewed by their connection speed — see the design spec's
  // "Preparing, then preload" note. Distractor options only ever render as
  // text (GuessButton), so nothing else needs preloading.
  useEffect(() => {
    if (state.status !== 'preparing') return
    let cancelled = false

    const loadOne = (url: string) =>
      new Promise<void>((resolve) => {
        const img = new window.Image()
        // Property assignment, not addEventListener: the test's mock Image
        // classes (see components/TimeTrialGame.test.tsx) only implement the
        // onload/onerror assignment protocol, not addEventListener.
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        img.onload = () => resolve()
        // oxlint-disable-next-line unicorn/prefer-add-event-listener
        img.onerror = () => resolve()
        img.src = url
      })
    const fallback = new Promise<void>((resolve) => {
      setTimeout(resolve, TIME_TRIAL_PRELOAD_FALLBACK_MS)
    })

    Promise.race([Promise.all(state.rounds.map((round) => loadOne(getSpriteUrl(round.pokemonId)))), fallback]).then(
      () => {
        if (!cancelled) dispatch({ type: 'PRELOADED', now: Date.now() })
      },
    )

    return () => {
      cancelled = true
    }
  }, [state.status, state.rounds])

  // Auto-advances a fixed delay after every reveal — right or wrong, this is
  // a speed mode, so momentum doesn't stop for a manual "Next" click.
  useEffect(() => {
    if (state.status !== 'revealed') return
    const timer = setTimeout(() => dispatch({ type: 'ADVANCE' }), TIME_TRIAL_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [state.status])

  // Ticks the displayed clock while the trial is running; frozen the moment
  // finishedAt is set so the displayed time always matches the persisted one.
  useEffect(() => {
    if (state.startedAt === null || state.finishedAt !== null) return
    const interval = setInterval(() => setDisplayNow(Date.now()), 100)
    return () => clearInterval(interval)
  }, [state.startedAt, state.finishedAt])

  // Reports the finished trial exactly once. Keyed on finishedAt (a fresh
  // timestamp every trial, null between trials) rather than a ref, so a
  // Retry's new trial naturally reports again without extra bookkeeping.
  useEffect(() => {
    if (state.status !== 'finished' || state.finishedAt === null || state.startedAt === null) return
    const correct = state.results.filter((result) => result.correct).length
    const elapsedMs = state.finishedAt - state.startedAt
    const rank = rankTimeTrial(correct, elapsedMs)
    // personalBest here is still the OLD best — this effect runs before
    // onFinish's parent-side update (setChallengesData) can flow back down
    // as a new prop value, so this is the correct "was this actually an
    // improvement" comparison, snapshotted once rather than left to be
    // recomputed later against a personalBest that has since become the
    // candidate itself.
    setFinishedIsNewBest(isBetterTimeTrialResult({ rank, elapsedMs, correct }, personalBest))
    onFinish({ generation, correct, elapsedMs, rank })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only finishedAt identifies a new report-worthy finish; personalBest is read as of this render deliberately, not tracked as a dep
  }, [state.status, state.finishedAt])

  if (state.status === 'finished') {
    const correct = state.results.filter((result) => result.correct).length
    const elapsedMs = (state.finishedAt ?? 0) - (state.startedAt ?? 0)
    const rank = rankTimeTrial(correct, elapsedMs)
    return (
      <TimeTrialResults
        rank={rank}
        elapsedMs={elapsedMs}
        correct={correct}
        totalRounds={state.rounds.length}
        results={state.results}
        isNewBest={finishedIsNewBest}
        onRetry={() => dispatch({ type: 'START', rng, generation, includeVariants })}
        onMainMenu={onExit}
      />
    )
  }

  if (state.status === 'preparing') return <Preparing />

  const currentRound = state.rounds[state.roundIndex]
  // Clamped to zero: displayNow is initialized at mount, before startedAt is
  // set (startedAt is only set once preload resolves, via PRELOADED — see
  // the displayNow state comment above), and the ticking interval's first
  // tick doesn't fire until 100ms later. Without the clamp, the render right
  // after PRELOADED computes displayNow - startedAt against that stale
  // mount-time displayNow, going negative for up to 100ms and rendering a
  // garbled time via formatElapsedMs (which has no negative-number guard).
  // Preferring finishedAt over displayNow once it's set also keeps this
  // live number consistent with what the results screen shows immediately
  // after — otherwise the very last tick can lag slightly behind the
  // persisted finishedAt - startedAt, causing a visible jump.
  const elapsedMs = state.startedAt === null ? 0 : Math.max(0, (state.finishedAt ?? displayNow) - state.startedAt)

  return (
    <>
      <div className="mb-4">
        <TimeTrialProgress roundIndex={state.roundIndex} totalRounds={state.rounds.length} elapsedMs={elapsedMs} />
      </div>
      <RoundView
        mounted={true}
        pokemonId={currentRound.pokemonId}
        roundId={state.roundId}
        status={state.status}
        options={currentRound.options}
        guess={state.guess}
        onReady={() => dispatch({ type: 'IMAGE_READY' })}
        onGuess={(pokemonId) => dispatch({ type: 'GUESS', pokemonId, now: Date.now() })}
      />
    </>
  )
}

export default TimeTrialGame
