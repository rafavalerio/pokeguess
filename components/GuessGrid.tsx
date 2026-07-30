import GuessButton, { type GuessState } from './GuessButton'

type Props = {
  options: number[]
  answer: number
  guess: number | null
  revealed: boolean
  disabled: boolean
  onGuess: (pokemonId: number) => void
}

const stateFor = (
  pokemonId: number,
  answer: number,
  guess: number | null,
  revealed: boolean,
): GuessState => {
  if (!revealed) return 'idle'
  if (pokemonId === answer) return 'correct'
  return pokemonId === guess ? 'wrong' : 'idle'
}

const GuessGrid = ({ options, answer, guess, revealed, disabled, onGuess }: Props) => (
  <div className="grid grid-cols-2 gap-2">
    {options.map((pokemonId) => (
      <GuessButton
        key={pokemonId}
        pokemonId={pokemonId}
        state={stateFor(pokemonId, answer, guess, revealed)}
        disabled={disabled}
        onClick={() => onGuess(pokemonId)}
      />
    ))}
  </div>
)

export default GuessGrid
