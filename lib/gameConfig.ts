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
