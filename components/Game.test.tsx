import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Game from './Game'
import { getPokemonName } from '@/lib/pokemon'
import { pokemonList } from '@/lib/pokemonData'

// Lets a test hold the sprite in its loading state by withholding the load
// event, which is otherwise fired immediately on mount.
const imageLoading = vi.hoisted(() => ({ neverLoads: false }))

vi.mock('next/image', async () => {
  const { useEffect } = await import('react')
  const MockImage = ({ onLoad, alt }: { onLoad?: () => void; alt: string }) => {
    // A real browser fires `load` once per mounted <img> element, not once
    // per render. An effect with an empty dep array mirrors that: it only
    // re-fires when this component instance remounts (e.g. on a `key`
    // change), matching browser behaviour closely enough to catch bugs where
    // a round fails to produce a fresh element.
    useEffect(() => {
      if (!imageLoading.neverLoads) onLoad?.()
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-only, see comment above
    }, [])
    // eslint-disable-next-line @next/next/no-img-element -- test stub, not real image usage
    return <img alt={alt} />
  }
  return { default: MockImage }
})

describe('Game', () => {
  // Math.random is pinned to 0.5 for every call in this file (see
  // beforeEach), and lib/game.ts's randomPokemon does
  // `pokemonList[Math.floor(rng() * pokemonList.length)]` — mirror that here
  // so this constant tracks lib/pokemonData.ts automatically instead of
  // going stale the next time the data is regenerated.
  const pinnedAnswerId = pokemonList[Math.floor(0.5 * pokemonList.length)].id

  beforeEach(() => {
    localStorage.clear()
    // Pinning Math.random to a constant value also means generateOptions's
    // random-draw loop exhausts its guard every round (see lib/game.ts) and
    // falls back to its deterministic sequential fill. The "wrong" option
    // these tests click is therefore always a low, fallback-filled id, not
    // a genuine random draw — harmless for what these tests assert, but
    // worth knowing so the fixed set of option names here doesn't look like
    // a mistake.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    imageLoading.neverLoads = false
  })

  it('hides the options until the sprite has loaded', () => {
    imageLoading.neverLoads = true
    render(<Game />)

    // No option name is readable while the silhouette is still loading, so the
    // answer cannot be guessed from the shortlist before it is visible.
    for (const id of [pinnedAnswerId, 1, 2, 3]) {
      expect(screen.queryByText(getPokemonName(id))).not.toBeInTheDocument()
    }
    // The grid's footprint is still reserved, so nothing shifts on load.
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('reveals the answer and scores a streak of 1 on a correct guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const answerName = getPokemonName(pinnedAnswerId)
    await user.click(screen.getByRole('button', { name: answerName }))

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('labels the advance button "Start again" after a wrong guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    const wrong = screen
      .getAllByRole('button')
      .find(
        (b) =>
          b.textContent !== getPokemonName(pinnedAnswerId) &&
          b.textContent !== 'Next' &&
          b.textContent !== 'Start again',
      )!
    await user.click(wrong)

    expect(screen.getByRole('button', { name: 'Start again' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('keeps the advance button labelled "Next" after a correct guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) }))

    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Start again' }),
    ).not.toBeInTheDocument()
  })

  it('persists the best streak to localStorage on a correct guess', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) }))

    expect(localStorage.getItem('bestStreak')).toBe('1')
  })

  it('does not lower a stored best streak on a wrong guess', async () => {
    localStorage.setItem('bestStreak', '7')
    const user = userEvent.setup()
    render(<Game />)

    const answerName = getPokemonName(pinnedAnswerId)
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

  it('stays playable across NEXT when the same Pokémon is drawn twice in a row', async () => {
    // Math.random is pinned to 0.5 for every call in this test file, so every
    // round draws the same pokemonId (pinnedAnswerId). This reproduces the
    // scenario a real repeat draw would hit: if the round's identity is keyed
    // on `pokemonId` instead of a value that changes every NEXT, the
    // silhouette never remounts, no load event fires, and the round is stuck
    // in 'loading' forever — GUESS is rejected and Next stays disabled.
    const user = userEvent.setup()
    render(<Game />)

    const answerName = getPokemonName(pinnedAnswerId)
    await user.click(screen.getByRole('button', { name: answerName }))
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: 'Next' }))

    // If the round is stuck in 'loading', the answer button is disabled and
    // this click is silently dropped instead of scoring.
    await user.click(await screen.findByRole('button', { name: answerName }))

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })
})
