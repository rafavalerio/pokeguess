import { ArrowLeft, Play, RotateCcw, Trophy } from 'lucide-react'

import type { GenerationFilter } from '@/lib/generations'

const primaryButtonClassName =
  'bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const secondaryButtonClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell enabled:hover:bg-screen-sunk flex w-full select-none items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const selectClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell w-full rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer disabled:cursor-default disabled:opacity-60'

// One row per generation (plus "All") for the stats screen. Computed by
// Game.tsx from localStorage, since that's where the per-generation values
// live — MainMenu just renders whatever rows it's handed.
export type StatsRow = { key: string; label: string; value: number | null }

type GenerationOption = { value: GenerationFilter; label: string }

type Props = {
  mode: 'menu' | 'stats'
  statsRows: StatsRow[]
  // Whether a run is currently in progress (streak > 0), restored from
  // localStorage the same way bestStreak is — see components/Game.tsx.
  // Swaps the single Play button for Continue + Start again, and locks the
  // generation select so an active run can't have its pool swapped out from
  // under it.
  canContinue: boolean
  generation: GenerationFilter
  generationOptions: readonly GenerationOption[]
  onGenerationChange: (generation: GenerationFilter) => void
  // Whether Mega Evolutions, regional forms and Gigantamax forms are in the
  // draw pool at all. Independent of `generation`: a form is scoped to
  // whichever generation introduced that specific form (e.g. Mega Charizard X
  // is Generation 6), not its base species', so this needs its own control
  // rather than being implied by the generation pick.
  includeVariants: boolean
  onIncludeVariantsChange: (includeVariants: boolean) => void
  onPlay: () => void
  onStartAgain: () => void
  onShowStats: () => void
  onBack: () => void
}

const MainMenu = ({
  mode,
  statsRows,
  canContinue,
  generation,
  generationOptions,
  onGenerationChange,
  includeVariants,
  onIncludeVariantsChange,
  onPlay,
  onStartAgain,
  onShowStats,
  onBack,
}: Props) => (
  <div className="flex flex-col items-center gap-6 py-10 text-center">
    <div>
      <h1 className="text-ink text-2xl font-bold tracking-tight">Pokéguess</h1>
      <p className="text-ink-soft mt-1 text-xs">Who&apos;s that Pokémon?</p>
    </div>

    {mode === 'menu' ? (
      <div className="flex w-full flex-col gap-4">
        <div className="text-left">
          <label htmlFor="generation" className="text-ink-soft mb-1 block text-xs font-medium">
            Generation
          </label>
          <select
            id="generation"
            value={String(generation)}
            disabled={canContinue}
            onChange={(event) => {
              const raw = event.target.value
              onGenerationChange(raw === 'all' ? 'all' : Number(raw))
            }}
            className={selectClassName}
          >
            {generationOptions.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
          {canContinue && (
            <p className="text-ink-soft mt-1 text-xs">Finish or start again to change generation.</p>
          )}
          <label htmlFor="includeVariants" className="text-ink mt-3 flex items-center gap-2 text-xs font-medium">
            <input
              id="includeVariants"
              type="checkbox"
              checked={includeVariants}
              disabled={canContinue}
              onChange={(event) => onIncludeVariantsChange(event.target.checked)}
              className="accent-shell border-screen-sunk focus-visible:ring-shell size-4 rounded border-2 enabled:cursor-pointer focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-60"
            />
            Include Mega Evolutions, regional & Gigantamax forms
          </label>
        </div>

        <div className="flex w-full flex-col gap-2">
          <button type="button" onClick={onPlay} className={primaryButtonClassName}>
            <Play className="size-4" aria-hidden="true" />
            {canContinue ? 'Continue' : 'Play'}
          </button>
          {canContinue && (
            <button type="button" onClick={onStartAgain} className={secondaryButtonClassName}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Start again
            </button>
          )}
          <button type="button" onClick={onShowStats} className={secondaryButtonClassName}>
            <Trophy className="size-4" aria-hidden="true" />
            Stats
          </button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          {statsRows.map((row) => (
            <div key={row.key} className="bg-screen-sunk flex items-center justify-between rounded-xl px-4 py-3">
              <p className="text-ink-soft text-xs font-medium">{row.label}</p>
              {/* tabular-nums so a row's width doesn't jump between "—" and a
                  multi-digit streak. */}
              <p className="text-ink text-lg font-semibold tabular-nums">{row.value === null ? '—' : row.value}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={onBack} className={secondaryButtonClassName}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </button>
      </div>
    )}
  </div>
)

export default MainMenu
