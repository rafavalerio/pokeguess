'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

import { getPokemonName, getSpeciesDex } from '@/lib/pokemon'

const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

type Props = {
  pokemonId: number
  roundId: number
  status: 'loading' | 'guessing' | 'revealed'
  onReady: () => void
}

const PokemonSilhouette = ({ pokemonId, roundId, status, onReady }: Props) => {
  const ref = useRef<HTMLImageElement>(null)
  const revealed = status === 'revealed'
  const loading = status === 'loading'

  // Keyed and re-run on `roundId`, not `dex`: a repeat dex draw across NEXT
  // would otherwise leave both unchanged, so the <img> would never remount
  // and no load event (nor this effect) would ever fire again, stranding the
  // round in 'loading' forever.
  useEffect(() => {
    if (ref.current?.complete) onReady()
  }, [roundId, onReady])

  return (
    <div
      className="bg-screen-sunk relative mx-auto flex size-48 select-none items-center justify-center rounded-full [-webkit-touch-callout:none] sm:size-56"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/*
        Kept mounted rather than unmounted on load, so it can fade out while
        the sprite pops in instead of blinking out of existence. The spin is
        only applied while loading, so an invisible ball is not animating.
      */}
      <Image
        src="/images/pokeball.png"
        alt=""
        aria-hidden="true"
        width={48}
        height={48}
        className={`pointer-events-none absolute size-10 select-none transition-opacity duration-200 ${
          loading ? 'animate-pokeball-spin opacity-100' : 'opacity-0'
        }`}
      />
      {/*
        The hidden state is only a CSS filter over the real sprite, so any
        browser affordance that renders the raw image — long-press callout,
        drag preview, selection highlight, "open image in new tab" — leaks the
        answer. `pointer-events-none` stops the sprite receiving those gestures
        at all; the rest are belt-and-braces for engines that treat callout and
        native drag separately from pointer events.
      */}
      <Image
        ref={ref}
        key={roundId}
        src={`${SPRITE_BASE}/${pokemonId}.png`}
        alt={
          revealed
            ? `${getPokemonName(pokemonId)}, number ${getSpeciesDex(pokemonId)}`
            : 'Hidden Pokémon silhouette'
        }
        width={192}
        height={192}
        priority
        draggable={false}
        onLoad={onReady}
        onError={onReady}
        className={`pointer-events-none size-40 select-none [-webkit-touch-callout:none] [-webkit-user-drag:none] transition-[filter] duration-300 sm:size-48 ${
          revealed ? 'brightness-100' : 'brightness-0'
        } ${loading ? 'opacity-0' : 'animate-sprite-pop opacity-100'}`}
      />
    </div>
  )
}

export default PokemonSilhouette
