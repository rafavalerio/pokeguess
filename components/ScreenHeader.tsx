type Size = 'large' | 'small'

const titleClassName: Record<Size, string> = {
  large: 'text-ink text-3xl font-bold tracking-tight',
  small: 'text-ink text-xl font-bold tracking-tight',
}

type Props = {
  title: string
  // Omitted entirely (no empty <p>) when there's nothing to say — the stats
  // screen's "Stats" heading has no subtitle.
  subtitle?: string
  // 'large' is the main menu's title (Pokéguess); 'small' is every other
  // screen's heading (Stats, and the game screen's "Who's that Pokémon?") —
  // one h1 per page, reserved for the menu, everything else is an h2.
  size?: Size
}

// Shared title/subtitle block so the menu, stats and game screens don't each
// hand-roll their own heading markup and drift out of sync with each other.
const ScreenHeader = ({ title, subtitle, size = 'large' }: Props) => {
  const Heading = size === 'large' ? 'h1' : 'h2'
  return (
    <div className="text-center">
      <Heading className={titleClassName[size]}>{title}</Heading>
      {subtitle && <p className="text-ink-soft mt-1 text-xs">{subtitle}</p>}
    </div>
  )
}

export default ScreenHeader
