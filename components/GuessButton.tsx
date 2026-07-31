import { Check, X } from 'lucide-react'

import { getPokemonName } from '@/lib/pokemon'

export type GuessState = 'idle' | 'correct' | 'wrong'

// Interactive styling is gated on `enabled:` throughout. A disabled button can
// still match :hover in CSS, so without the gate the revealed answers and the
// loading skeletons would both light up under the cursor as if they were live.
const styles: Record<GuessState, string> = {
  idle: 'bg-button text-ink border-screen-sunk enabled:hover:border-shell enabled:hover:bg-screen-sunk enabled:hover:-translate-y-px enabled:active:translate-y-0',
  correct: 'bg-correct text-correct-ink border-correct',
  wrong: 'bg-wrong text-wrong-ink border-wrong',
}

// Shared with Game.tsx's GuessGridPlaceholder so the pre-hydration skeleton
// cannot silently drift from the real button's layout — that drift is exactly
// the layout shift the placeholder exists to prevent.
export const guessButtonClassName = (state: GuessState): string =>
  `focus-visible:ring-shell flex w-full select-none items-center justify-start gap-2.5 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition duration-150 focus-visible:ring-2 focus-visible:outline-none enabled:cursor-pointer disabled:cursor-default ${styles[state]}`

// The bordered "1"-"4" badge doubles as the keyboard-shortcut hint, so it only
// shows while that shortcut is live (idle, i.e. still guessing) and only on
// screens with a keyboard (sm and up) — on mobile it's just the name.
const markerClassName =
  'text-ink-soft/40 hidden size-5 shrink-0 items-center justify-center rounded border border-current/40 text-xs font-semibold sm:flex'

type Props = {
  pokemonId: number
  index: number
  state: GuessState
  disabled: boolean
  onClick: () => void
}

const GuessButton = ({ pokemonId, index, state, disabled, onClick }: Props) => (
  <button type="button" onClick={onClick} disabled={disabled} className={guessButtonClassName(state)}>
    {state === 'correct' && <Check className="size-4 shrink-0" aria-hidden="true" />}
    {state === 'wrong' && <X className="size-4 shrink-0" aria-hidden="true" />}
    {state === 'idle' && !disabled && (
      <span aria-hidden="true" className={markerClassName}>
        {index + 1}
      </span>
    )}
    <span className="truncate text-left">{getPokemonName(pokemonId)}</span>
  </button>
)

export default GuessButton
