import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Game from './Game'
import { getPokemonName } from '@/lib/pokemon'

vi.mock('next/image', async () => {
  const { useEffect } = await import('react')
  const MockImage = ({ onLoad, alt }: { onLoad?: () => void; alt: string }) => {
    useEffect(() => {
      onLoad?.()
    }, [onLoad])
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
    return <img alt={alt} />
  }
  return { default: MockImage }
})

describe('Game', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reveals the answer and scores a streak of 1 on a correct guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const answerName = getPokemonName(453)
    await user.click(screen.getByRole('button', { name: answerName }))

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('persists the best streak to localStorage on a correct guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: getPokemonName(453) }))

    expect(localStorage.getItem('bestStreak')).toBe('1')
  })

  it('does not lower a stored best streak on a wrong guess', async () => {
    localStorage.setItem('bestStreak', '7')
    const user = userEvent.setup()
    render(<Game />)

    const answerName = getPokemonName(453)
    const options = await screen.findAllByRole('button', { name: /.+/ })
    const wrongOption = options.find(
      (option) => option.textContent !== 'Next' && option.textContent !== answerName,
    )
    if (!wrongOption) throw new Error('Expected at least one wrong option to be rendered')
    await user.click(wrongOption)

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-best')).toHaveTextContent('7')
    expect(localStorage.getItem('bestStreak')).toBe('7')
  })

  it('hydrates and displays a stored best streak on mount', async () => {
    localStorage.setItem('bestStreak', '12')
    render(<Game />)

    expect(await screen.findByTestId('stat-best')).toHaveTextContent('12')
  })
})
