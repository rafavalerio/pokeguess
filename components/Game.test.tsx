import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
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

// Game now opens on the main menu; every test below exercises the game
// screen itself, so this renders and immediately clicks past the menu. The
// button reads "Continue" instead of "Play" whenever a stored run is
// restored (see components/MainMenu.tsx), so this matches either.
const renderGame = async (): Promise<UserEvent> => {
  const user = userEvent.setup()
  render(<Game />)
  await user.click(screen.getByRole('button', { name: /^(Play|Continue)$/ }))
  return user
}

// The game screen's buttons are the Home button (top right, alongside the
// shell's lamps), the four guess options, and the Next/Start again advance
// button. This isolates just the four options regardless of where Home sits
// in DOM order, so tests don't have to know that ordering.
const getGuessButtons = (): HTMLElement[] =>
  screen
    .getAllByRole('button')
    .filter(
      (b) =>
        b.getAttribute('aria-label') !== 'Home' &&
        b.textContent !== 'Next' &&
        b.textContent !== 'Start again',
    )

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

  it('opens on the main menu, not the game', () => {
    render(<Game />)

    expect(screen.getByRole('heading', { name: 'Pokéguess' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.queryByTestId('stat-streak')).not.toBeInTheDocument()
  })

  it('shows the best streak on the stats screen and returns to the menu on Back', async () => {
    localStorage.setItem('bestStreak', '9')
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: 'Stats' }))
    expect(await screen.findByText('9')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('returns to the menu on Home, preserving the run so the menu offers Continue', async () => {
    const user = await renderGame()

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })) // correct, streak 1
    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.getByRole('heading', { name: 'Pokéguess' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
  })

  it('offers Start again from the menu once a run is in progress, resetting the streak', async () => {
    const user = await renderGame()

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })) // correct, streak 1
    await user.click(screen.getByRole('button', { name: 'Home' }))

    await user.click(screen.getByRole('button', { name: 'Start again' }))
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('0')
  })

  it('hides the options until the sprite has loaded', async () => {
    imageLoading.neverLoads = true
    await renderGame()

    // No option name is readable while the silhouette is still loading, so the
    // answer cannot be guessed from the shortlist before it is visible.
    for (const id of [pinnedAnswerId, 1, 2, 3]) {
      expect(screen.queryByText(getPokemonName(id))).not.toBeInTheDocument()
    }
    // The grid's footprint is still reserved, so nothing shifts on load.
    // Home + 4 guess slots + Next.
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('reveals the answer and scores a streak of 1 on a correct guess', async () => {
    const user = await renderGame()

    const answerName = getPokemonName(pinnedAnswerId)
    await user.click(screen.getByRole('button', { name: answerName }))

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('labels the advance button "Start again" after a wrong guess', async () => {
    const user = await renderGame()

    const answerButton = screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })
    const wrong = getGuessButtons().find((b) => b !== answerButton)!
    await user.click(wrong)

    expect(screen.getByRole('button', { name: 'Start again' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('keeps the advance button labelled "Next" after a correct guess', async () => {
    const user = await renderGame()

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) }))

    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Start again' }),
    ).not.toBeInTheDocument()
  })

  it('persists the best streak to localStorage on a correct guess', async () => {
    const user = await renderGame()

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) }))

    expect(localStorage.getItem('bestStreak')).toBe('1')
  })

  it('does not lower a stored best streak on a wrong guess', async () => {
    localStorage.setItem('bestStreak', '7')
    const user = await renderGame()

    const answerButton = screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })
    await screen.findAllByRole('button', { name: /.+/ })
    const wrongOption = getGuessButtons().find((option) => option !== answerButton)
    if (!wrongOption) throw new Error('Expected at least one wrong option to be rendered')
    await user.click(wrongOption)

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('0')
    expect(screen.getByTestId('stat-best')).toHaveTextContent('7')
    expect(localStorage.getItem('bestStreak')).toBe('7')
  })

  it('hydrates and displays a stored best streak on mount', async () => {
    localStorage.setItem('bestStreak', '12')
    await renderGame()

    expect(await screen.findByTestId('stat-best')).toHaveTextContent('12')
  })

  it('persists the streak and used ids to localStorage on a correct guess', async () => {
    const user = await renderGame()

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) }))

    expect(localStorage.getItem('streak')).toBe('1')
    expect(JSON.parse(localStorage.getItem('usedIds')!)).toEqual([pinnedAnswerId])
  })

  it('resets the persisted streak and used ids on a wrong guess', async () => {
    const user = await renderGame()

    const answerButton = screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })
    const wrong = getGuessButtons().find((b) => b !== answerButton)!
    await user.click(wrong)

    expect(localStorage.getItem('streak')).toBe('0')
  })

  it('restores a stored streak and used ids on mount, resuming the run', async () => {
    // pinnedAnswerId is excluded via a stored usedIds entry, so with
    // Math.random pinned to 0.5 every draw attempt keeps landing on it and
    // falls through to randomPokemonExcluding's deterministic fallback: the
    // first pokemonList entry that isn't excluded.
    localStorage.setItem('streak', '4')
    localStorage.setItem('usedIds', JSON.stringify([pinnedAnswerId]))
    await renderGame()

    expect(await screen.findByTestId('stat-streak')).toHaveTextContent('4')
    const nextAnswerId = pokemonList.find((entry) => entry.id !== pinnedAnswerId)!.id
    expect(await screen.findByRole('button', { name: getPokemonName(nextAnswerId) })).toBeInTheDocument()
  })

  it('ignores a stored run with a zero streak, starting fresh', async () => {
    localStorage.setItem('streak', '0')
    localStorage.setItem('usedIds', JSON.stringify([]))
    await renderGame()

    expect(await screen.findByRole('button', { name: getPokemonName(pinnedAnswerId) })).toBeInTheDocument()
  })

  it('stays playable across NEXT when the same Pokémon is drawn twice in a row', async () => {
    // Math.random is pinned to 0.5, so any round drawn with an empty
    // no-repeat exclusion set resolves to pinnedAnswerId (see lib/game.ts's
    // randomPokemonExcluding). A run's exclusion set resets the moment it
    // ends, so guessing wrong on the very first round reproduces two
    // consecutive rounds landing on the same pokemonId — the scenario a real
    // repeat draw would hit: if the round's identity is keyed on `pokemonId`
    // instead of a value that changes every NEXT, the silhouette never
    // remounts, no load event fires, and the round is stuck in 'loading'
    // forever — GUESS is rejected and the guess is silently dropped.
    const user = await renderGame()

    const answerName = getPokemonName(pinnedAnswerId)
    const answerButton = screen.getByRole('button', { name: answerName })
    const wrong = getGuessButtons().find((b) => b !== answerButton)!
    await user.click(wrong)
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('0')

    await user.click(screen.getByRole('button', { name: 'Start again' }))

    // If the round is stuck in 'loading', the answer button is disabled and
    // this click is silently dropped instead of scoring.
    await user.click(await screen.findByRole('button', { name: answerName }))

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('scores a guess triggered by pressing the matching number key', async () => {
    const user = await renderGame()

    const answerButton = screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })
    // GuessGrid's options render in the same order as their on-screen number
    // badges.
    const answerIndex = getGuessButtons().indexOf(answerButton)

    await user.keyboard(String(answerIndex + 1))

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('ignores a number key guess when a modifier key is held', async () => {
    const user = await renderGame()

    const answerButton = screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })
    const answerIndex = getGuessButtons().indexOf(answerButton)

    // e.g. Cmd+1 is a browser tab-switch shortcut and must not double as a guess.
    await user.keyboard(`{Meta>}${answerIndex + 1}{/Meta}`)

    expect(screen.getByTestId('stat-streak')).toHaveTextContent('0')
    expect(answerButton).toBeEnabled()
  })

  it('advances to the next round when Space is pressed after a correct guess', async () => {
    const user = await renderGame()

    const answerName = getPokemonName(pinnedAnswerId)
    await user.click(screen.getByRole('button', { name: answerName }))
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('1')

    await user.keyboard(' ')

    // pinnedAnswerId is now excluded for the rest of this run (no-repeat), and
    // Math.random stays pinned to 0.5, so every random draw attempt keeps
    // landing back on the excluded id and falls through to
    // randomPokemonExcluding's deterministic fallback: the first pokemonList
    // entry that isn't excluded.
    const nextAnswerId = pokemonList.find((entry) => entry.id !== pinnedAnswerId)!.id
    await user.click(await screen.findByRole('button', { name: getPokemonName(nextAnswerId) }))
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('2')
  })

  it('advances via Space but not N after a wrong guess, since the button reads "Start again"', async () => {
    const user = await renderGame()

    const answerButton = screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })
    const wrong = getGuessButtons().find((b) => b !== answerButton)!
    await user.click(wrong)
    expect(screen.getByRole('button', { name: 'Start again' })).toBeEnabled()

    await user.keyboard('n')
    expect(screen.getByRole('button', { name: 'Start again' })).toBeEnabled()

    await user.keyboard(' ')
    expect(screen.queryByRole('button', { name: 'Start again' })).not.toBeInTheDocument()
  })
})
