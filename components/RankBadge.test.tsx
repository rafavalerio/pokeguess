import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import RankBadge from './RankBadge'

describe('RankBadge', () => {
  it('renders the rank letter', () => {
    render(<RankBadge rank="A" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('gives S its own gold treatment, distinct from the other ranks', () => {
    const { unmount } = render(<RankBadge rank="S" />)
    expect(screen.getByText('S').className).toContain('bg-best/40')
    unmount()

    render(<RankBadge rank="A" />)
    expect(screen.getByText('A').className).not.toContain('bg-best/40')
  })

  it('renders larger at size="lg"', () => {
    render(<RankBadge rank="B" size="lg" />)
    expect(screen.getByText('B').className).toContain('size-16')
  })

  it('defaults to the small size', () => {
    render(<RankBadge rank="C" />)
    expect(screen.getByText('C').className).toContain('size-7')
  })
})
