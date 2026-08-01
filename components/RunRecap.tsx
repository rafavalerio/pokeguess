import Image from 'next/image'

import { getSpriteUrl } from '@/lib/pokemon'

export type RecapEntry = { id: number; name: string }

type Props = {
  // Which generation the run was played in ('All generations', 'Generation
  // 3 · Hoenn', ...) — Game.tsx resolves this the same way MainMenu's
  // "current run" summary does, from GENERATION_SELECT_OPTIONS.
  generationLabel: string
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

const RecapRow = ({ entry, round, wrong }: { entry: RecapEntry; round: number; wrong?: boolean }) => (
  <div className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${wrong ? 'bg-wrong' : 'bg-screen-sunk'}`}>
    {/* black/10 rather than a fixed color, so the badge reads as "a shade
        darker than this row's own background" whether the row is
        bg-screen-sunk (correct) or bg-wrong (missed), instead of needing a
        separate hardcoded tone per row type. min-w-5 + px-1.5 (rather than a
        fixed size-5) makes this a pill that grows for a 3-4 digit round
        number — "all generations" runs can pass 1000 — instead of clipping
        digits outside a fixed circle. */}
    <span
      data-testid="recap-round"
      className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-black/10 px-1.5 text-xs font-semibold tabular-nums ${
        wrong ? 'text-wrong-ink' : 'text-ink-soft'
      }`}
    >
      {round}
    </span>
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
const RunRecap = ({ generationLabel, correctEntries, bestStreak, isNewBest, missedAnswer, guessedAnswer }: Props) => (
  <div className="mb-3 flex flex-col gap-3 text-left">
    <div
      className={`rounded-2xl px-4 py-4 text-center ${
        isNewBest ? 'bg-best/40 border-lamp-amber border-2' : 'bg-screen-sunk border-2 border-transparent'
      }`}
    >
      <p className="text-ink-soft text-xs font-medium">{generationLabel}</p>
      {isNewBest && (
        <p className="text-best-ink mt-1 text-xs font-semibold tracking-wide uppercase">New best!</p>
      )}
      {/* grid-cols-2 (rather than flex + gap) keeps both halves the same
          width regardless of "Final streak" being longer than "Best", so the
          divider — and each number under it — lands dead center. */}
      <div className="divide-ink-soft/20 mt-2 grid grid-cols-2 divide-x">
        <div>
          <p className="text-ink-soft text-xs font-medium">Final streak</p>
          <p className="text-ink mt-1 text-3xl font-semibold tabular-nums" data-testid="final-streak">
            {correctEntries.length}
          </p>
        </div>
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
        {correctEntries.map((entry, index) => (
          <RecapRow key={entry.id} entry={entry} round={index + 1} />
        ))}
      </div>
    )}

    <div>
      <p className="text-ink-soft mb-1.5 text-xs font-medium">You missed</p>
      <RecapRow entry={missedAnswer} round={correctEntries.length + 1} wrong />
      <p className="text-ink-soft mt-1.5 text-xs">
        You guessed <span className="text-ink font-medium">{guessedAnswer.name}</span>
      </p>
    </div>
  </div>
)

export default RunRecap
