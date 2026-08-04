import { guessButtonClassName } from './GuessButton'
import GuessGrid from './GuessGrid'
import PokemonSilhouette from './PokemonSilhouette'
import type { Status } from '@/lib/game'
import { getPokemonName, getSpeciesDex } from '@/lib/pokemon'

// Reserves the exact footprint PokemonSilhouette renders at, so a caller that
// can't show the real silhouette yet (Game.tsx, before its hydration gate
// opens — see CLAUDE.md's hydration-constraint section) has nothing shift
// underneath it once the real content swaps in.
const SilhouettePlaceholder = () => (
  <div className="bg-screen-sunk mx-auto flex size-48 items-center justify-center rounded-full sm:size-56" />
)

// Each slot holds a skeleton bar rather than sitting empty: four blank boxes
// read as broken, where a bar reads as "not ready yet". The bar sits inside
// the same button box, so the slot keeps the exact height of the loaded state.
const GuessGridPlaceholder = () => (
  <div className="flex flex-col gap-2">
    {[0, 1, 2, 3].map((slot) => (
      // These skeletons are disabled and unlabelled on purpose: they exist to
      // hold the slot's footprint until the real options arrive. Labelling them
      // would announce four fake options that cannot be pressed.
      // oxlint-disable-next-line jsx-a11y/control-has-associated-label
      <button key={slot} type="button" disabled className={guessButtonClassName('idle')}>
        <span className="hidden size-5 shrink-0 sm:block" />
        <span className="flex h-5 items-center">
          <span className="bg-screen-sunk block h-2.5 w-16 animate-pulse rounded-full" />
        </span>
      </button>
    ))}
  </div>
)

type Props = {
  // false only for Game.tsx's Full Dex mode before its hydration gate opens.
  // TimeTrialGame mounts purely client-side (only reachable via a menu
  // click), so it always passes true.
  mounted: boolean
  pokemonId: number
  roundId: number
  status: Status
  options: number[]
  guess: number | null
  onReady: () => void
  onGuess: (pokemonId: number) => void
}

// The silhouette + revealed name + guess grid trio, shared by Game.tsx's
// Full Dex mode and TimeTrialGame — the only difference between the two
// callers is what drives status/options/guess, not how they're shown.
const RoundView = ({ mounted, pokemonId, roundId, status, options, guess, onReady, onGuess }: Props) => {
  const revealed = status === 'revealed'
  return (
    <>
      <div className="mb-3">
        {mounted ? (
          <PokemonSilhouette pokemonId={pokemonId} roundId={roundId} status={status} onReady={onReady} />
        ) : (
          <SilhouettePlaceholder />
        )}
      </div>

      <p className="text-ink mb-4 h-6 text-center text-sm font-semibold tabular-nums" data-testid="round-answer">
        {revealed ? `#${getSpeciesDex(pokemonId)} · ${getPokemonName(pokemonId)}` : ' '}
      </p>

      {mounted && status !== 'loading' ? (
        <GuessGrid
          options={options}
          answer={pokemonId}
          guess={guess}
          revealed={revealed}
          disabled={status !== 'guessing'}
          onGuess={onGuess}
        />
      ) : (
        <GuessGridPlaceholder />
      )}
    </>
  )
}

export default RoundView
