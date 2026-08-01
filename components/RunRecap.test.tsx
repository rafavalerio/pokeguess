import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import RunRecap from './RunRecap'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

const baseProps = {
  correctEntries: [
    { id: 1, name: 'Bulbasaur' },
    { id: 2, name: 'Ivysaur' },
  ],
  bestStreak: 5,
  isNewBest: false,
  missedAnswer: { id: 3, name: 'Venusaur' },
  guessedAnswer: { id: 4, name: 'Charmander' },
}

describe('RunRecap', () => {
  it('shows the final streak as the count of correctly guessed entries', () => {
    render(<RunRecap {...baseProps} />)

    expect(screen.getByText('Final streak')).toBeInTheDocument()
    expect(screen.getByTestId('final-streak')).toHaveTextContent('2')
  })

  it('shows the overall best streak alongside the final one', () => {
    render(<RunRecap {...baseProps} bestStreak={5} />)

    expect(screen.getByText('Best')).toBeInTheDocument()
    expect(screen.getByTestId('final-best')).toHaveTextContent('5')
  })

  it('shows an em dash for the best streak when there is none yet', () => {
    render(<RunRecap {...baseProps} bestStreak={null} />)

    expect(screen.getByTestId('final-best')).toHaveTextContent('—')
  })

  it('highlights the streak box and labels it "New best!" when isNewBest is true', () => {
    render(<RunRecap {...baseProps} isNewBest={true} />)

    expect(screen.getByText('New best!')).toBeInTheDocument()
  })

  it('does not show the "New best!" label otherwise', () => {
    render(<RunRecap {...baseProps} isNewBest={false} />)

    expect(screen.queryByText('New best!')).not.toBeInTheDocument()
  })

  it('lists every correctly guessed entry by name', () => {
    render(<RunRecap {...baseProps} />)

    expect(screen.getByText('Bulbasaur')).toBeInTheDocument()
    expect(screen.getByText('Ivysaur')).toBeInTheDocument()
  })

  it('shows the missed answer and what was guessed instead', () => {
    render(<RunRecap {...baseProps} correctEntries={[]} />)

    expect(screen.getByText('You missed')).toBeInTheDocument()
    expect(screen.getByText('Venusaur')).toBeInTheDocument()
    expect(screen.getByText('Charmander')).toBeInTheDocument()
  })

  it('omits the correct-guesses list entirely when the run ended on the first round', () => {
    render(<RunRecap {...baseProps} correctEntries={[]} />)

    expect(screen.getByTestId('final-streak')).toHaveTextContent('0')
  })
})
