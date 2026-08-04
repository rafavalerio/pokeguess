import { describe, expect, it } from 'vitest'

import {
  DIFFICULTY_CURVE,
  TIME_TRIAL_ROUND_COUNT,
  TIME_TRIAL_S_RANK_MAX_SECONDS,
  hardDistractorCountForStreak,
  rankTimeTrial,
} from './gameConfig'

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

describe('rankTimeTrial', () => {
  it('ranks a flawless run under the S threshold as S', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT, (TIME_TRIAL_S_RANK_MAX_SECONDS - 1) * 1000)).toBe('S')
  })

  it('ranks a flawless run exactly at the S threshold as S', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT, TIME_TRIAL_S_RANK_MAX_SECONDS * 1000)).toBe('S')
  })

  it('ranks a flawless run just over the S threshold as A', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT, TIME_TRIAL_S_RANK_MAX_SECONDS * 1000 + 1)).toBe('A')
  })

  it('ranks exactly one mistake as B regardless of time', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 1, 1)).toBe('B')
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 1, 999999)).toBe('B')
  })

  it('ranks exactly two mistakes as C', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 2, 1)).toBe('C')
  })

  it('ranks three or more mistakes as D', () => {
    expect(rankTimeTrial(TIME_TRIAL_ROUND_COUNT - 3, 1)).toBe('D')
    expect(rankTimeTrial(0, 1)).toBe('D')
  })
})
