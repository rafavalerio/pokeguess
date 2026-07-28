const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="text-ink-soft text-xs">{label}</span>
    <span className="text-ink text-sm font-medium" data-testid={`stat-${label.toLowerCase()}`}>
      {value}
    </span>
  </div>
)

type Props = {
  streak: number
  bestStreak: number | null
}

const ScoreBoard = ({ streak, bestStreak }: Props) => (
  <div className="flex items-center justify-center gap-5">
    <Stat label="Streak" value={String(streak)} />
    <Stat label="Best" value={bestStreak === null ? '—' : String(bestStreak)} />
  </div>
)

export default ScoreBoard
