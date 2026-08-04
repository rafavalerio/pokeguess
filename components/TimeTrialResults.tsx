import { Check, X } from 'lucide-react'
import Image from 'next/image'

import RankBadge from './RankBadge'
import type { TimeTrialRank } from '@/lib/gameConfig'
import { getPokemonName, getSpriteUrl } from '@/lib/pokemon'
import { formatElapsedMs } from '@/lib/timeTrial'

type ResultEntry = { pokemonId: number; guess: number; correct: boolean }

type Props = {
  rank: TimeTrialRank
  elapsedMs: number
  correct: number
  totalRounds: number
  results: ResultEntry[]
  isNewBest: boolean
  onRetry: () => void
  onMainMenu: () => void
}

const primaryButtonClassName =
  'bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const secondaryButtonClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell enabled:hover:bg-screen-sunk flex w-full select-none items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const ResultRow = ({
  round,
  pokemonId,
  guess,
  correct,
}: {
  round: number
  pokemonId: number
  guess: number
  correct: boolean
}) => (
  <div className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${correct ? 'bg-screen-sunk' : 'bg-wrong'}`}>
    <span
      className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-black/10 px-1.5 text-xs font-semibold tabular-nums ${
        correct ? 'text-ink-soft' : 'text-wrong-ink'
      }`}
    >
      {round}
    </span>
    <Image src={getSpriteUrl(pokemonId)} alt="" aria-hidden="true" width={32} height={32} className="size-8 shrink-0" />
    <div className="min-w-0 flex-1 text-left">
      <p className={`truncate text-sm font-medium ${correct ? 'text-ink' : 'text-wrong-ink'}`}>
        {getPokemonName(pokemonId)}
      </p>
      {!correct && <p className="text-wrong-ink/80 truncate text-xs">Guessed {getPokemonName(guess)}</p>}
    </div>
    {correct ? (
      <Check className="text-correct size-4 shrink-0" aria-hidden="true" />
    ) : (
      <X className="text-wrong-ink size-4 shrink-0" aria-hidden="true" />
    )}
  </div>
)

const TimeTrialResults = ({
  rank,
  elapsedMs,
  correct,
  totalRounds,
  results,
  isNewBest,
  onRetry,
  onMainMenu,
}: Props) => (
  <div className="mb-3 flex flex-col gap-3 text-left">
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl px-4 py-4 text-center ${
        isNewBest ? 'bg-best/40 border-lamp-amber border-2' : 'bg-screen-sunk border-2 border-transparent'
      }`}
    >
      {isNewBest && <p className="text-best-ink text-xs font-semibold tracking-wide uppercase">New personal best!</p>}
      <RankBadge rank={rank} size="lg" />
      <div className="divide-ink-soft/20 grid w-full grid-cols-2 divide-x">
        <div>
          <p className="text-ink-soft text-xs font-medium">Time</p>
          <p className="text-ink mt-1 text-2xl font-semibold tabular-nums">{formatElapsedMs(elapsedMs)}</p>
        </div>
        <div>
          <p className="text-ink-soft text-xs font-medium">Correct</p>
          <p className="text-ink mt-1 text-2xl font-semibold tabular-nums">{`${correct}/${totalRounds}`}</p>
        </div>
      </div>
    </div>

    <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
      {results.map((entry, index) => (
        <ResultRow
          key={`${entry.pokemonId}-${index}`}
          round={index + 1}
          pokemonId={entry.pokemonId}
          guess={entry.guess}
          correct={entry.correct}
        />
      ))}
    </div>

    <div className="flex flex-col gap-2">
      <button type="button" onClick={onRetry} className={primaryButtonClassName}>
        Retry
      </button>
      <button type="button" onClick={onMainMenu} className={secondaryButtonClassName}>
        Main menu
      </button>
    </div>
  </div>
)

export default TimeTrialResults
