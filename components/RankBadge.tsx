import type { TimeTrialRank } from '@/lib/gameConfig'

const RANK_STYLES: Record<TimeTrialRank, string> = {
  S: 'bg-best/40 border-lamp-amber text-best-ink',
  A: 'bg-screen-sunk border-transparent text-ink-strong',
  B: 'bg-screen-sunk border-transparent text-ink-strong',
  C: 'bg-screen-sunk border-transparent text-ink-strong',
  D: 'bg-screen-sunk border-transparent text-ink-strong',
}

type Props = {
  rank: TimeTrialRank
  size?: 'sm' | 'lg'
}

// The one place a Time Trial rank turns into a badge, shared by the results
// screen (size="lg") and the Challenges list (default "sm") so the two never
// pick different colors for the same rank.
const RankBadge = ({ rank, size = 'sm' }: Props) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 font-bold tabular-nums ${RANK_STYLES[rank]} ${
      size === 'lg' ? 'size-16 text-3xl' : 'size-7 text-sm'
    }`}
  >
    {rank}
  </span>
)

export default RankBadge
