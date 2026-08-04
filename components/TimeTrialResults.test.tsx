import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import TimeTrialResults from './TimeTrialResults'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const baseProps = {
  rank: 'B' as const,
  elapsedMs: 65432,
  correct: 8,
  totalRounds: 10,
  // ids 1/2 are real dex entries (Bulbasaur/Ivysaur) and 4 is Charmander,
  // same convention RunRecap.test.tsx uses, so getPokemonName resolves them
  // without any mocking.
  results: [
    { pokemonId: 1, guess: 1, correct: true },
    { pokemonId: 2, guess: 4, correct: false },
  ],
  isNewBest: false,
  onRetry: vi.fn<() => void>(),
  onMainMenu: vi.fn<() => void>(),
}

describe('TimeTrialResults', () => {
  it('shows the rank, formatted time and correct count', () => {
    render(<TimeTrialResults {...baseProps} />)

    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('1:05.4')).toBeInTheDocument()
    expect(screen.getByText('8/10')).toBeInTheDocument()
  })

  it('shows a "New personal best!" banner only when isNewBest is true', () => {
    const { rerender } = render(<TimeTrialResults {...baseProps} isNewBest={false} />)
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument()

    rerender(<TimeTrialResults {...baseProps} isNewBest={true} />)
    expect(screen.getByText('New personal best!')).toBeInTheDocument()
  })

  it('lists every round by its Pokémon name', () => {
    render(<TimeTrialResults {...baseProps} />)

    expect(screen.getByText('Bulbasaur')).toBeInTheDocument()
    expect(screen.getByText('Ivysaur')).toBeInTheDocument()
  })

  it('shows what was guessed instead for a wrong round', () => {
    render(<TimeTrialResults {...baseProps} />)

    expect(screen.getByText('Guessed Charmander')).toBeInTheDocument()
  })

  it('calls onRetry when Retry is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn<() => void>()
    render(<TimeTrialResults {...baseProps} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('calls onMainMenu when Main menu is clicked', async () => {
    const user = userEvent.setup()
    const onMainMenu = vi.fn<() => void>()
    render(<TimeTrialResults {...baseProps} onMainMenu={onMainMenu} />)

    await user.click(screen.getByRole('button', { name: 'Main menu' }))
    expect(onMainMenu).toHaveBeenCalledOnce()
  })
})
