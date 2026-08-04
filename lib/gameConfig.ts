// Ordered ascending by minStreak; the first band's minStreak must be 0.
// hardDistractorCountForStreak picks the highest band the streak has reached.
export const DIFFICULTY_CURVE: readonly { minStreak: number; hardDistractors: number }[] = [
  { minStreak: 0, hardDistractors: 0 },
  { minStreak: 3, hardDistractors: 1 },
  { minStreak: 8, hardDistractors: 2 },
  { minStreak: 15, hardDistractors: 3 },
]

// |speciesDex_a - speciesDex_b| <= this counts as "same family".
export const DEX_PROXIMITY = 2

// Normalized name-similarity score (0-1) to count as "similar spelling".
export const SIMILARITY_THRESHOLD = 0.5

export const hardDistractorCountForStreak = (streak: number): number => {
  let count = DIFFICULTY_CURVE[0].hardDistractors
  for (const band of DIFFICULTY_CURVE) {
    if (streak < band.minStreak) break
    count = band.hardDistractors
  }
  return count
}

// A Time Trial is always this many rounds.
export const TIME_TRIAL_ROUND_COUNT = 10

// Fixed for every round of every Time Trial; independent of DIFFICULTY_CURVE
// so it can be tuned on its own later without touching the streak-based ramp.
export const TIME_TRIAL_HARD_DISTRACTORS = 0

// Pause on each reveal (correct or wrong) before auto-advancing to the next
// round.
export const TIME_TRIAL_REVEAL_MS = 900

// If sprite preloading hasn't resolved by this long, the trial starts anyway
// rather than leaving the player stuck on "Preparing your trial…" forever.
export const TIME_TRIAL_PRELOAD_FALLBACK_MS = 8000

// Only reachable with zero mistakes; a slower flawless run is still an A.
export const TIME_TRIAL_S_RANK_MAX_SECONDS = 45

export type TimeTrialRank = 'S' | 'A' | 'B' | 'C' | 'D'

// Mistake count gates the tier — a single miss can never be outrun into an S
// or A no matter how fast the rest of the trial was — and elapsed time only
// ever breaks the S/A tie within an otherwise-flawless run.
export const rankTimeTrial = (correct: number, elapsedMs: number): TimeTrialRank => {
  const mistakes = TIME_TRIAL_ROUND_COUNT - correct
  if (mistakes === 0) return elapsedMs <= TIME_TRIAL_S_RANK_MAX_SECONDS * 1000 ? 'S' : 'A'
  if (mistakes === 1) return 'B'
  if (mistakes === 2) return 'C'
  return 'D'
}
