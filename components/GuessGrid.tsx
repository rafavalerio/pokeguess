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
  <div className="flex flex-col gap-2">
    {options.map((pokemonId, index) => (
      <GuessButton
        key={pokemonId}
        pokemonId={pokemonId}
        index={index}
        state={stateFor(pokemonId, answer, guess, revealed)}
        disabled={disabled}
        onClick={() => onGuess(pokemonId)}
      />
    ))}
  </div>
)

export default GuessGrid
