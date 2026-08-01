import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import RunRecap from './RunRecap'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

describe('RunRecap', () => {
  it('shows the final streak as the count of correctly guessed entries', () => {
    render(
      <RunRecap
        correctEntries={[
          { id: 1, name: 'Bulbasaur' },
          { id: 2, name: 'Ivysaur' },
        ]}
        missedAnswer={{ id: 3, name: 'Venusaur' }}
        guessedAnswer={{ id: 4, name: 'Charmander' }}
      />,
    )

    expect(screen.getByText('Final streak')).toBeInTheDocument()
    expect(screen.getByTestId('final-streak')).toHaveTextContent('2')
  })

  it('lists every correctly guessed entry by name', () => {
    render(
      <RunRecap
        correctEntries={[
          { id: 1, name: 'Bulbasaur' },
          { id: 2, name: 'Ivysaur' },
        ]}
        missedAnswer={{ id: 3, name: 'Venusaur' }}
        guessedAnswer={{ id: 4, name: 'Charmander' }}
      />,
    )

    expect(screen.getByText('Bulbasaur')).toBeInTheDocument()
    expect(screen.getByText('Ivysaur')).toBeInTheDocument()
  })

  it('shows the missed answer and what was guessed instead', () => {
    render(
      <RunRecap
        correctEntries={[]}
        missedAnswer={{ id: 3, name: 'Venusaur' }}
        guessedAnswer={{ id: 4, name: 'Charmander' }}
      />,
    )

    expect(screen.getByText('You missed')).toBeInTheDocument()
    expect(screen.getByText('Venusaur')).toBeInTheDocument()
    expect(screen.getByText('Charmander')).toBeInTheDocument()
  })

  it('omits the correct-guesses list entirely when the run ended on the first round', () => {
    render(
      <RunRecap
        correctEntries={[]}
        missedAnswer={{ id: 3, name: 'Venusaur' }}
        guessedAnswer={{ id: 4, name: 'Charmander' }}
      />,
    )

    expect(screen.getByTestId('final-streak')).toHaveTextContent('0')
  })
})
