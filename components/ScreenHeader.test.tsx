import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ScreenHeader from './ScreenHeader'

describe('ScreenHeader', () => {
  it('renders the title as an h1 by default (size="large")', () => {
    render(<ScreenHeader title="Pokéguess" />)

    const heading = screen.getByRole('heading', { name: 'Pokéguess' })
    expect(heading.tagName).toBe('H1')
  })

  it('renders the title as an h2 when size="small"', () => {
    render(<ScreenHeader title="Stats" size="small" />)

    const heading = screen.getByRole('heading', { name: 'Stats' })
    expect(heading.tagName).toBe('H2')
  })

  it('shows the subtitle when provided', () => {
    render(<ScreenHeader title="Pokéguess" subtitle="Who's that Pokémon?" />)

    expect(screen.getByText("Who's that Pokémon?")).toBeInTheDocument()
  })

  it('renders no subtitle text when omitted', () => {
    const { container } = render(<ScreenHeader title="Stats" size="small" />)

    expect(container.querySelectorAll('p')).toHaveLength(0)
  })
})
