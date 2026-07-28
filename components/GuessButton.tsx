import { Check, X } from 'lucide-react'

import { getPokemonName } from '@/lib/pokemon'

export type GuessState = 'idle' | 'correct' | 'wrong'

const styles: Record<GuessState, string> = {
  idle: 'bg-button text-ink border-screen-sunk hover:border-shell hover:bg-screen-sunk',
  correct: 'bg-correct text-correct-ink border-correct',
  wrong: 'bg-wrong text-wrong-ink border-wrong',
}

type Props = {
  dex: number
  state: GuessState
  disabled: boolean
  onClick: () => void
}

const GuessButton = ({ dex, state, disabled, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`focus-visible:ring-shell flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default ${styles[state]}`}
  >
    {state === 'correct' && <Check className="size-4 shrink-0" aria-hidden="true" />}
    {state === 'wrong' && <X className="size-4 shrink-0" aria-hidden="true" />}
    <span className="truncate">{getPokemonName(dex)}</span>
  </button>
)

export default GuessButton
