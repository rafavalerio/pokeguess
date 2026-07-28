import GuessButton, { type GuessState } from './GuessButton'

type Props = {
  options: number[]
  answer: number
  guess: number | null
  revealed: boolean
  onGuess: (dex: number) => void
}

const stateFor = (
  dex: number,
  answer: number,
  guess: number | null,
  revealed: boolean,
): GuessState => {
  if (!revealed) return 'idle'
  if (dex === answer) return 'correct'
  return dex === guess ? 'wrong' : 'idle'
}

const GuessGrid = ({ options, answer, guess, revealed, onGuess }: Props) => (
  <div className="grid grid-cols-2 gap-2">
    {options.map((dex) => (
      <GuessButton
        key={dex}
        dex={dex}
        state={stateFor(dex, answer, guess, revealed)}
        disabled={revealed}
        onClick={() => onGuess(dex)}
      />
    ))}
  </div>
)

export default GuessGrid
