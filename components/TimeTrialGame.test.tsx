import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TimeTrialGame from './TimeTrialGame'
import {
  TIME_TRIAL_PRELOAD_FALLBACK_MS,
  TIME_TRIAL_REVEAL_MS,
  TIME_TRIAL_ROUND_COUNT,
  rankTimeTrial,
  type TimeTrialRank,
} from '@/lib/gameConfig'
import type { GenerationFilter } from '@/lib/generations'

type FinishPayload = { generation: GenerationFilter; correct: number; elapsedMs: number; rank: TimeTrialRank }

vi.mock('next/image', async () => {
  const { useEffect } = await import('react')
  const MockImage = ({ onLoad, alt }: { onLoad?: () => void; alt: string }) => {
    useEffect(() => {
      onLoad?.()
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, mirrors a real <img>'s one-time load event
    }, [])
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
    return <img alt={alt} />
  }
  return { default: MockImage }
})

// Resolves on the next microtask, mimicking a cache-warm image load — fake
// timers (see beforeEach) don't affect microtask scheduling, so this settles
// on its own without needing to advance any timer.
class MockPreloadImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    Promise.resolve().then(() => this.onload?.())
  }
}

const getGuessButtons = (): HTMLElement[] =>
  screen.getAllByRole('button').filter((b) => b.textContent !== 'Retry' && b.textContent !== 'Main menu')

describe('TimeTrialGame', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockPreloadImage)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Clicks the first rendered guess option every round, then reads the
  // revealed answer to learn ground truth. This never predicts which
  // Pokémon the trial's internal rng actually drew — it only observes what
  // RoundView reveals — so it stays correct regardless of the draw.
  const playThrough = async (user: ReturnType<typeof userEvent.setup>): Promise<number> => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0) // let the preload microtasks settle
    })

    let correct = 0
    for (let round = 1; round <= TIME_TRIAL_ROUND_COUNT; round += 1) {
      expect(screen.getByText(`Round ${round}/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
      const button = getGuessButtons()[0]
      // GuessButton always renders the name as its last child span — reading
      // that specifically (rather than the whole button's textContent) skips
      // the leading aria-hidden keyboard-marker digit ("1", "2", …) that
      // precedes it while idle, which textContent doesn't otherwise exclude.
      const guessedName = button.querySelector('span:last-child')?.textContent ?? ''
      await user.click(button)

      const revealedText = screen.getByTestId('round-answer').textContent ?? ''
      if (revealedText.endsWith(guessedName)) correct += 1

      await act(async () => {
        await vi.advanceTimersByTimeAsync(TIME_TRIAL_REVEAL_MS)
      })
    }
    return correct
  }

  it('shows the round counter once the trial is ready', async () => {
    render(
      <TimeTrialGame
        generation="all"
        includeVariants={false}
        personalBest={null}
        onFinish={vi.fn<(result: FinishPayload) => void>()}
        onExit={vi.fn<() => void>()}
      />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(`Round 1/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })

  it('plays through all 10 rounds and reports the finished trial exactly once', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onFinish = vi.fn<(result: FinishPayload) => void>()
    render(
      <TimeTrialGame
        generation="all"
        includeVariants={false}
        personalBest={null}
        onFinish={onFinish}
        onExit={vi.fn<() => void>()}
      />,
    )

    const correct = await playThrough(user)

    expect(onFinish).toHaveBeenCalledOnce()
    const payload = onFinish.mock.calls[0][0]
    expect(payload.generation).toBe('all')
    expect(payload.correct).toBe(correct)
    expect(payload.elapsedMs).toBeGreaterThan(0)
    expect(payload.rank).toBe(rankTimeTrial(correct, payload.elapsedMs))
    expect(screen.getByText(`${correct}/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })

  it('calls onExit when Main menu is clicked from the results screen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onExit = vi.fn<() => void>()
    render(
      <TimeTrialGame
        generation="all"
        includeVariants={false}
        personalBest={null}
        onFinish={vi.fn<(result: FinishPayload) => void>()}
        onExit={onExit}
      />,
    )

    await playThrough(user)
    await user.click(screen.getByRole('button', { name: 'Main menu' }))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('starts a fresh trial when Retry is clicked from the results screen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <TimeTrialGame
        generation="all"
        includeVariants={false}
        personalBest={null}
        onFinish={vi.fn<(result: FinishPayload) => void>()}
        onExit={vi.fn<() => void>()}
      />,
    )

    await playThrough(user)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText(`Round 1/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })

  it('still starts the trial if a sprite never finishes preloading, via the fallback timeout', async () => {
    class NeverLoadsImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        // Deliberately never resolves, to exercise the fallback timeout.
      }
    }
    vi.stubGlobal('Image', NeverLoadsImage)

    render(
      <TimeTrialGame
        generation="all"
        includeVariants={false}
        personalBest={null}
        onFinish={vi.fn<(result: FinishPayload) => void>()}
        onExit={vi.fn<() => void>()}
      />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIME_TRIAL_PRELOAD_FALLBACK_MS)
    })
    expect(screen.getByText(`Round 1/${TIME_TRIAL_ROUND_COUNT}`)).toBeInTheDocument()
  })
})
