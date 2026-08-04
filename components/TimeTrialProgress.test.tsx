import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TimeTrialProgress from './TimeTrialProgress'

describe('TimeTrialProgress', () => {
  it('shows the 1-indexed round out of the total', () => {
    render(<TimeTrialProgress roundIndex={3} totalRounds={10} elapsedMs={0} />)
    expect(screen.getByText('Round 4/10')).toBeInTheDocument()
  })

  it('shows the elapsed time formatted as m:ss.t', () => {
    render(<TimeTrialProgress roundIndex={0} totalRounds={10} elapsedMs={65432} />)
    expect(screen.getByTestId('time-trial-clock')).toHaveTextContent('1:05.4')
  })
})
