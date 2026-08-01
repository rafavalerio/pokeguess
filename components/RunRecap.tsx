import Image from 'next/image'

import { getSpriteUrl } from '@/lib/pokemon'

export type RecapEntry = { id: number; name: string }

type Props = {
  // Every Pokémon guessed correctly this run, oldest first.
  correctEntries: RecapEntry[]
  bestStreak: number | null
  // Whether this run's streak pushed bestStreak past what it was before the
  // run started (see lib/game.ts's isNewBest) — highlights the streak box
  // rather than needing a separate banner.
  isNewBest: boolean
  missedAnswer: RecapEntry
  guessedAnswer: RecapEntry
}

const RecapRow = ({ entry, wrong }: { entry: RecapEntry; wrong?: boolean }) => (
  <div className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${wrong ? 'bg-wrong' : 'bg-screen-sunk'}`}>
    <Image
      src={getSpriteUrl(entry.id)}
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className="size-8 shrink-0"
    />
    <span className={`truncate text-sm font-medium ${wrong ? 'text-wrong-ink' : 'text-ink'}`}>{entry.name}</span>
  </div>
)

// Shown in place of the round UI once a wrong guess ends the run, so the
// streak and the miss stay on screen instead of disappearing the moment
// "Start again" is pressed. The persistent advance button below (see
// Game.tsx) is what actually starts the next run — this is a read-only recap.
// It carries both stat numbers ScoreBoard would otherwise show, since
// Game.tsx hides ScoreBoard for this screen (its live "Streak" would already
// read 0, which reads as a contradiction sitting right above this box).
const RunRecap = ({ correctEntries, bestStreak, isNewBest, missedAnswer, guessedAnswer }: Props) => (
  <div className="mb-3 flex flex-col gap-3 text-left">
    <div
      className={`rounded-2xl px-4 py-4 text-center ${
        isNewBest ? 'bg-shell/10 border-shell border-2' : 'bg-screen-sunk border-2 border-transparent'
      }`}
    >
      {isNewBest && <p className="text-shell mb-2 text-xs font-semibold tracking-wide uppercase">New best!</p>}
      <div className="flex items-center justify-center gap-8">
        <div>
          <p className="text-ink-soft text-xs font-medium">Final streak</p>
          <p className="text-ink mt-1 text-3xl font-semibold tabular-nums" data-testid="final-streak">
            {correctEntries.length}
          </p>
        </div>
        <div className="bg-ink-soft/20 h-10 w-px" aria-hidden="true" />
        <div>
          <p className="text-ink-soft text-xs font-medium">Best</p>
          <p className="text-ink mt-1 text-3xl font-semibold tabular-nums" data-testid="final-best">
            {bestStreak === null ? '—' : bestStreak}
          </p>
        </div>
      </div>
    </div>

    {correctEntries.length > 0 && (
      <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
        {correctEntries.map((entry) => (
          <RecapRow key={entry.id} entry={entry} />
        ))}
      </div>
    )}

    <div>
      <p className="text-ink-soft mb-1.5 text-xs font-medium">You missed</p>
      <RecapRow entry={missedAnswer} wrong />
      <p className="text-ink-soft mt-1.5 text-xs">
        You guessed <span className="text-ink font-medium">{guessedAnswer.name}</span>
      </p>
    </div>
  </div>
)

export default RunRecap
