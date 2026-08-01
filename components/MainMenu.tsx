const primaryButtonClassName =
  'bg-shell focus-visible:ring-shell enabled:hover:bg-shell-dark flex w-full select-none items-center justify-center rounded-lg py-2.5 text-sm font-semibold text-button transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

const secondaryButtonClassName =
  'bg-button text-ink border-screen-sunk focus-visible:ring-shell enabled:hover:border-shell enabled:hover:bg-screen-sunk flex w-full select-none items-center justify-center rounded-lg border-2 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer enabled:active:scale-[0.99]'

type Props = {
  mode: 'menu' | 'stats'
  bestStreak: number | null
  onPlay: () => void
  onShowStats: () => void
  onBack: () => void
}

const MainMenu = ({ mode, bestStreak, onPlay, onShowStats, onBack }: Props) => (
  <div className="flex flex-col items-center gap-6 py-10 text-center">
    <div>
      <h1 className="text-ink text-2xl font-bold tracking-tight">Pokéguess</h1>
      <p className="text-ink-soft mt-1 text-xs">Who&apos;s that Pokémon?</p>
    </div>

    {mode === 'menu' ? (
      <div className="flex w-full flex-col gap-2">
        <button type="button" onClick={onPlay} className={primaryButtonClassName}>
          Play
        </button>
        <button type="button" onClick={onShowStats} className={secondaryButtonClassName}>
          Stats
        </button>
      </div>
    ) : (
      <div className="flex w-full flex-col gap-4">
        <div className="bg-screen-sunk rounded-xl px-4 py-6">
          <p className="text-ink-soft text-xs font-medium">Best streak</p>
          <p className="text-ink mt-1 text-3xl font-semibold tabular-nums">
            {bestStreak === null ? '—' : bestStreak}
          </p>
        </div>
        <button type="button" onClick={onBack} className={secondaryButtonClassName}>
          Back
        </button>
      </div>
    )}
  </div>
)

export default MainMenu
