import { ChevronDown, Play, RotateCcw, Swords, Timer, Trophy } from 'lucide-react'

import RankBadge from './RankBadge'
import ScreenHeader from './ScreenHeader'
import type { GenerationFilter } from '@/lib/generations'
import { formatElapsedMs, type TimeTrialBest } from '@/lib/timeTrial'

const primaryButtonClassName =
  'bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark flex w-full select-none items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const secondaryButtonClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell enabled:hover:bg-screen-sunk flex w-full select-none items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

// Rendered only when no run is in progress (see the canContinue branch
// below), so neither this nor the checkbox below it needs disabled: styling
// — they're never shown in a disabled state.
const selectClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell hover:border-shell w-full cursor-pointer appearance-none rounded-lg border-2 py-2.5 pr-9 pl-3 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none'

// One row per generation (plus "All") for the stats screen. Computed by
// Game.tsx from localStorage, since that's where the per-generation values
// live — MainMenu just renders whatever rows it's handed. `total` is the
// generation's base-species pool size, the denominator for "value/total";
// value >= total means every Pokémon in that pool has been named.
export type StatsRow = { key: string; label: string; value: number | null; total: number }

// One row per generation (plus "All") for the Challenges screen, same shape
// as StatsRow but tracking Time Trial's personal best and attempt count
// instead of a streak.
export type ChallengeRow = { key: string; label: string; best: TimeTrialBest | null; attempts: number }

type GenerationOption = { value: GenerationFilter; label: string }

type Props = {
  mode: 'menu' | 'stats' | 'challenges'
  statsRows: StatsRow[]
  challengesRows: ChallengeRow[]
  // Whether a run is currently in progress (streak > 0), restored from
  // localStorage the same way bestStreak is — see components/Game.tsx.
  // Swaps the generation/variants picker for a "current run" summary and the
  // Full Dex/Time Trial buttons for Continue + Start again. Time Trial has
  // no equivalent "current run" state to resume, so it's simply unavailable
  // until the Full Dex run in progress ends or is reset.
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
  onPlayFullDex: () => void
  onPlayTimeTrial: () => void
  onContinue: () => void
  onStartAgain: () => void
  onShowStats: () => void
  onShowChallenges: () => void
}

const MainMenu = ({
  mode,
  statsRows,
  challengesRows,
  canContinue,
  streak,
  generation,
  generationOptions,
  onGenerationChange,
  includeVariants,
  onIncludeVariantsChange,
  onPlayFullDex,
  onPlayTimeTrial,
  onContinue,
  onStartAgain,
  onShowStats,
  onShowChallenges,
}: Props) => {
  const currentGenerationLabel =
    generationOptions.find((option) => option.value === generation)?.label ?? 'All generations'

  return (
    <div className={`flex flex-col items-center gap-6 text-center ${mode === 'menu' ? 'py-10' : 'pt-1 pb-6'}`}>
      {mode === 'menu' ? (
        <ScreenHeader title="Pokéguess" subtitle="Who's that Pokémon?" />
      ) : (
        // Replaces the title/subtitle above (this screen has its own Back
        // button in PokedexShell's corner, not here) — sits close to the top
        // rather than inheriting the menu's centered, py-10 feel.
        <ScreenHeader title={mode === 'stats' ? 'Stats' : 'Challenges'} size="small" />
      )}

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
              <div className="relative">
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
                <ChevronDown
                  className="text-ink-soft pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
              </div>
              <label htmlFor="includeVariants" className="text-ink mt-3 flex items-start gap-2 text-xs font-medium">
                <input
                  id="includeVariants"
                  type="checkbox"
                  checked={includeVariants}
                  onChange={(event) => onIncludeVariantsChange(event.target.checked)}
                  className="accent-shell border-screen-sunk focus-visible:ring-shell size-4 shrink-0 cursor-pointer rounded border-2 focus-visible:ring-2 focus-visible:outline-none"
                />
                <span>Include Mega Evolutions, regional & Gigantamax forms</span>
              </label>
            </div>
          )}

          <div className="flex w-full flex-col gap-2">
            {canContinue ? (
              <>
                <button type="button" onClick={onContinue} className={primaryButtonClassName}>
                  <Play className="size-4" aria-hidden="true" />
                  Continue
                </button>
                <button type="button" onClick={onStartAgain} className={secondaryButtonClassName}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Start again
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={onPlayFullDex} className={primaryButtonClassName}>
                  <Play className="size-4" aria-hidden="true" />
                  Full Dex
                </button>
                <button type="button" onClick={onPlayTimeTrial} className={primaryButtonClassName}>
                  <Timer className="size-4" aria-hidden="true" />
                  Time Trial
                </button>
              </>
            )}
            <button type="button" onClick={onShowStats} className={secondaryButtonClassName}>
              <Trophy className="size-4" aria-hidden="true" />
              Stats
            </button>
            <button type="button" onClick={onShowChallenges} className={secondaryButtonClassName}>
              <Swords className="size-4" aria-hidden="true" />
              Challenges
            </button>
          </div>
        </div>
      ) : mode === 'stats' ? (
        <div className="flex w-full flex-col gap-2">
          {statsRows.map((row) => {
            // Same amber "new best" treatment RunRecap and the win screen
            // use (bg-best/40 + border-lamp-amber): the generation where the
            // player has named every Pokémon in its pool gets the trophy and
            // the nicer border, and drops the "/total" since the value and
            // the total are the same number.
            const gotThemAll = row.value !== null && row.value >= row.total
            return (
              <div
                key={row.key}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  gotThemAll ? 'bg-best/40 border-lamp-amber border-2' : 'bg-screen-sunk border-2 border-transparent'
                }`}
              >
                <p className="text-ink-soft text-xs font-medium">{row.label}</p>
                <div className="flex items-center gap-1.5">
                  {gotThemAll && <Trophy className="text-best-ink size-4" aria-hidden="true" />}
                  {/* tabular-nums so a row's width doesn't jump as the value changes. */}
                  <p
                    className={`text-lg font-semibold tabular-nums ${gotThemAll ? 'text-best-ink' : 'text-ink-strong'}`}
                  >
                    {row.value === null ? `—/${row.total}` : gotThemAll ? row.total : `${row.value}/${row.total}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {challengesRows.map((row) => (
            <div
              key={row.key}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                row.best?.rank === 'S' ? 'bg-best/40 border-lamp-amber border-2' : 'bg-screen-sunk border-2 border-transparent'
              }`}
            >
              <div className="text-left">
                <p className="text-ink-soft text-xs font-medium">{row.label}</p>
                <p className="text-ink-soft mt-0.5 text-xs">
                  {row.attempts === 0 ? 'Not played yet' : `Played ${row.attempts} time${row.attempts === 1 ? '' : 's'}`}
                </p>
              </div>
              {row.best ? (
                <div className="flex items-center gap-2">
                  <RankBadge rank={row.best.rank} />
                  <p className="text-ink-strong text-sm font-semibold tabular-nums">
                    {formatElapsedMs(row.best.elapsedMs)}
                  </p>
                </div>
              ) : (
                <p className="text-ink-soft text-lg font-semibold">—</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MainMenu
