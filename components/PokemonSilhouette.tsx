'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

import formatDexNumber from '@/lib/formatDexNumber'
import { getPokemonName } from '@/lib/pokemon'

const SPRITE_BASE =
  'https://raw.githubusercontent.com/rafavalerio/pokemon-sprites/master/images'

type Props = {
  dex: number
  roundId: number
  status: 'loading' | 'guessing' | 'revealed'
  onReady: () => void
}

const PokemonSilhouette = ({ dex, roundId, status, onReady }: Props) => {
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
    <div className="bg-screen-sunk relative mx-auto flex size-48 items-center justify-center rounded-full sm:size-56">
      {loading && (
        <Image
          src="/images/pokeball.png"
          alt=""
          aria-hidden="true"
          width={48}
          height={48}
          className="absolute size-10 animate-pulse select-none"
        />
      )}
      <Image
        ref={ref}
        key={roundId}
        src={`${SPRITE_BASE}/${formatDexNumber(dex)}.png`}
        alt={revealed ? `${getPokemonName(dex)}, number ${dex}` : 'Hidden Pokémon silhouette'}
        width={192}
        height={192}
        priority
        draggable={false}
        onLoad={onReady}
        onError={onReady}
        className={`size-40 select-none transition-[filter] duration-300 sm:size-48 ${
          revealed ? 'brightness-100' : 'brightness-0'
        } ${loading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  )
}

export default PokemonSilhouette
