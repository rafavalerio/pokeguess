import { ArrowLeft, Play, RotateCcw, Trophy } from 'lucide-react'

import type { GenerationFilter } from '@/lib/generations'

const primaryButtonClassName =
  'bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const secondaryButtonClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell enabled:hover:bg-screen-sunk flex w-full select-none items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

// Rendered only when no run is in progress (see the canContinue branch
// below), so neither this nor the checkbox below it needs disabled: styling
// — they're never shown in a disabled state.
const selectClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell hover:border-shell w-full cursor-pointer rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none'

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
  // Swaps the generation/variants picker for a "current run" summary and the
  // single Play button for Continue + Start again.
  canContinue: boolean
  // The active run's streak, shown in the "current run" summary while
  // canContinue is true. Unused otherwise.
  streak: number
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
  streak,
  generation,
  generationOptions,
  onGenerationChange,
  includeVariants,
  onIncludeVariantsChange,
  onPlay,
  onStartAgain,
  onShowStats,
  onBack,
}: Props) => {
  const currentGenerationLabel =
    generationOptions.find((option) => option.value === generation)?.label ?? 'All generations'

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">Pokéguess</h1>
        <p className="text-ink-soft mt-1 text-xs">Who&apos;s that Pokémon?</p>
      </div>

      {mode === 'menu' ? (
        <div className="flex w-full flex-col gap-4">
          {canContinue ? (
            <div className="text-left">
              <p className="text-ink-soft mb-1 text-xs font-medium">Current run</p>
              <div className="bg-screen-sunk flex items-center justify-between gap-3 rounded-xl px-4 py-3">
                <div>
                  <p className="text-ink text-sm font-semibold">{currentGenerationLabel}</p>
                  {includeVariants && (
                    <p className="text-ink-soft text-xs">Includes Mega, regional & Gigantamax forms</p>
                  )}
                </div>
                <p className="text-ink-soft shrink-0 text-xs font-medium">
                  Streak <span className="text-ink font-semibold tabular-nums">{streak}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="text-left">
              <label htmlFor="generation" className="text-ink-soft mb-1 block text-xs font-medium">
                Generation
              </label>
              <select
                id="generation"
                value={String(generation)}
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
              <label htmlFor="includeVariants" className="text-ink mt-3 flex items-start gap-2 text-xs font-medium">
                <input
                  id="includeVariants"
                  type="checkbox"
                  checked={includeVariants}
                  onChange={(event) => onIncludeVariantsChange(event.target.checked)}
                  className="accent-shell border-screen-sunk focus-visible:ring-shell mt-0.5 size-4 shrink-0 cursor-pointer rounded border-2 focus-visible:ring-2 focus-visible:outline-none"
                />
                <span>Include Mega Evolutions, regional & Gigantamax forms</span>
              </label>
            </div>
          )}

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
}

export default MainMenu
