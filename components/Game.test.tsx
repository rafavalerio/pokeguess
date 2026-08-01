import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Game from './Game'
import { pokemonPoolFor } from '@/lib/generations'
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
  // `pool[Math.floor(rng() * pool.length)]` — mirror that here so this
  // constant tracks lib/pokemonData.ts automatically instead of going stale
  // the next time the data is regenerated. Every test below reaches the game
  // screen via Play/Continue, which — with the default, unchecked "include
  // variants" setting — draws from the base-species-only pool, not the raw
  // pokemonList (see lib/generations.ts's pokemonPoolFor).
  const defaultPool = pokemonPoolFor('all', false)
  const pinnedAnswerId = defaultPool[Math.floor(0.5 * defaultPool.length)].id

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

  it('resets the run without leaving the menu when Start again is clicked, so a new pick is offered right away', async () => {
    const user = await renderGame()

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })) // correct, streak 1
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start again' }))

    // Still on the menu — the streak is gone and the generation picker is
    // back, rather than dropping straight into a fresh round.
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Generation')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Play' }))
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

describe('Generation selection', () => {
  // Math.random is pinned to 0.5 for every test in this file (see
  // beforeEach), so an unscoped ('all') run resolves to this id — see the
  // outer describe block's identical pinnedAnswerId for the same reasoning.
  const pinnedAnswerId = pokemonPoolFor('all', false)[Math.floor(0.5 * pokemonPoolFor('all', false).length)].id
  // A run scoped to generation 1, with the default (unchecked) "include
  // variants" setting, resolves to this entry the same way. Generation 1 has
  // no forms of its own regardless (no form kind maps to generation 1 — see
  // scripts/build-pokemon-data.mjs's FORM_GENERATION_BY_KIND), so this
  // happens to match pokemonPoolFor(1, true) too, but false is what Play
  // actually uses by default.
  const gen1Pool = pokemonPoolFor(1, false)
  const pinnedGen1Id = gen1Pool[Math.floor(0.5 * gen1Pool.length)].id

  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to "All generations" and offers every generation as an option', () => {
    render(<Game />)

    const select = screen.getByLabelText('Generation') as HTMLSelectElement
    expect(select.value).toBe('all')
    expect(screen.getByRole('option', { name: 'Generation 1 · Kanto' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Generation 9 · Paldea' })).toBeInTheDocument()
  })

  it('scopes a fresh run to the selected generation', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.selectOptions(screen.getByLabelText('Generation'), 'Generation 1 · Kanto')
    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(await screen.findByRole('button', { name: getPokemonName(pinnedGen1Id) })).toBeInTheDocument()
  })

  it('persists the picked generation even before a run starts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Game />)

    await user.selectOptions(screen.getByLabelText('Generation'), 'Generation 1 · Kanto')
    unmount()

    render(<Game />)
    expect(await screen.findByLabelText('Generation')).toHaveValue('1')
  })

  it('tracks a separate best streak per generation, leaving the "all" key untouched', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.selectOptions(screen.getByLabelText('Generation'), 'Generation 1 · Kanto')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedGen1Id) })) // correct, streak 1

    expect(localStorage.getItem('bestStreak:gen1')).toBe('1')
    expect(localStorage.getItem('bestStreak')).toBeNull()
  })

  it('shows a best-streak row for every generation plus All on the stats screen', async () => {
    localStorage.setItem('bestStreak', '9')
    localStorage.setItem('bestStreak:gen1', '3')
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByRole('button', { name: 'Stats' }))

    expect(screen.getByText('All generations')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('Generation 1 · Kanto')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    // A generation with no recorded run yet shows an em dash, not 0.
    expect(screen.getByText('Generation 2 · Johto')).toBeInTheDocument()
  })

  it('replaces the generation select with a current-run summary once a run is in progress', async () => {
    const user = await renderGame()

    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })) // correct, streak 1
    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.queryByLabelText('Generation')).not.toBeInTheDocument()
    expect(screen.getByText('Current run')).toBeInTheDocument()
    expect(screen.getByText('All generations')).toBeInTheDocument()
  })

  it('shows the generation select again once a run ends on a wrong guess', async () => {
    const user = await renderGame()

    const answerButton = screen.getByRole('button', { name: getPokemonName(pinnedAnswerId) })
    const wrong = getGuessButtons().find((b) => b !== answerButton)!
    await user.click(wrong)
    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.getByLabelText('Generation')).toBeEnabled()
  })

  it('resumes a restored run against the generation it was played in', async () => {
    localStorage.setItem('selectedGeneration', '1')
    localStorage.setItem('streak', '4')
    localStorage.setItem('usedIds', JSON.stringify([pinnedGen1Id]))
    render(<Game />)

    await screen.findByRole('button', { name: 'Continue' })
    expect(screen.getByText('Generation 1 · Kanto')).toBeInTheDocument()
  })
})

describe('Include variants', () => {
  const pinnedExcludingVariants = pokemonPoolFor('all', false)[
    Math.floor(0.5 * pokemonPoolFor('all', false).length)
  ].id
  const pinnedIncludingVariants = pokemonPoolFor('all', true)[
    Math.floor(0.5 * pokemonPoolFor('all', true).length)
  ].id

  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to unchecked, drawing base species only', async () => {
    const user = userEvent.setup()
    render(<Game />)

    expect(screen.getByLabelText(/Include Mega Evolutions/)).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByRole('button', { name: getPokemonName(pinnedExcludingVariants) })).toBeInTheDocument()
  })

  it('when checked, includes Mega/regional/Gigantamax forms in the draw pool', async () => {
    const user = userEvent.setup()
    render(<Game />)

    await user.click(screen.getByLabelText(/Include Mega Evolutions/))
    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(await screen.findByRole('button', { name: getPokemonName(pinnedIncludingVariants) })).toBeInTheDocument()
  })

  it('persists the checkbox pick across a reload before any run starts', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Game />)

    await user.click(screen.getByLabelText(/Include Mega Evolutions/))
    unmount()

    render(<Game />)
    expect(await screen.findByLabelText(/Include Mega Evolutions/)).toBeChecked()
    expect(localStorage.getItem('includeVariants')).toBe('true')
  })

  it('hides the checkbox behind a current-run summary once a run is in progress', async () => {
    const user = await renderGame()

    // renderGame's default Play uses the default (unchecked) pool.
    await user.click(screen.getByRole('button', { name: getPokemonName(pinnedExcludingVariants) })) // correct, streak 1
    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.queryByLabelText(/Include Mega Evolutions/)).not.toBeInTheDocument()
  })

  it('resumes a restored run honoring the includeVariants it was played with', async () => {
    localStorage.setItem('includeVariants', 'true')
    localStorage.setItem('streak', '4')
    localStorage.setItem('usedIds', JSON.stringify([pinnedIncludingVariants]))
    render(<Game />)

    await screen.findByRole('button', { name: 'Continue' })
    expect(screen.getByText(/Includes Mega, regional & Gigantamax forms/)).toBeInTheDocument()
  })
})
