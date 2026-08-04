import { formatElapsedMs } from '@/lib/timeTrial'

type Props = {
  roundIndex: number
  totalRounds: number
  elapsedMs: number
}

// Replaces ScoreBoard on the Time Trial screen: a round counter and a live
// ticking clock instead of streak/best.
const TimeTrialProgress = ({ roundIndex, totalRounds, elapsedMs }: Props) => (
  <div className="flex items-center justify-center gap-5">
    <span className="text-ink text-sm font-semibold tabular-nums">{`Round ${roundIndex + 1}/${totalRounds}`}</span>
    <span className="text-ink text-sm font-semibold tabular-nums" data-testid="time-trial-clock">
      {formatElapsedMs(elapsedMs)}
    </span>
  </div>
)

export default TimeTrialProgress
