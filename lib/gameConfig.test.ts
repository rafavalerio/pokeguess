import { describe, expect, it } from 'vitest'

import { DIFFICULTY_CURVE, hardDistractorCountForStreak } from './gameConfig'

describe('hardDistractorCountForStreak', () => {
  it('returns 0 below the first non-zero band', () => {
    expect(hardDistractorCountForStreak(0)).toBe(0)
    expect(hardDistractorCountForStreak(2)).toBe(0)
  })

  it('returns 1 for streak 3 through 7', () => {
    expect(hardDistractorCountForStreak(3)).toBe(1)
    expect(hardDistractorCountForStreak(7)).toBe(1)
  })

  it('returns 2 for streak 8 through 14', () => {
    expect(hardDistractorCountForStreak(8)).toBe(2)
    expect(hardDistractorCountForStreak(14)).toBe(2)
  })

  it('returns 3 for streak 15 and beyond', () => {
    expect(hardDistractorCountForStreak(15)).toBe(3)
    expect(hardDistractorCountForStreak(1000)).toBe(3)
  })

  it('matches DIFFICULTY_CURVE at every band boundary', () => {
    for (const band of DIFFICULTY_CURVE) {
      expect(hardDistractorCountForStreak(band.minStreak)).toBe(band.hardDistractors)
    }
  })
})
