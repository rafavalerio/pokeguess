'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

import formatDexNumber from '@/lib/formatDexNumber'

const SPRITE_BASE =
  'https://raw.githubusercontent.com/rafavalerio/pokemon-sprites/master/images'

type Props = {
  dex: number
  revealed: boolean
  onReady: () => void
}

const PokemonSilhouette = ({ dex, revealed, onReady }: Props) => {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (ref.current?.complete) onReady()
  }, [dex, onReady])

  return (
    <div className="bg-screen-sunk mx-auto flex size-48 items-center justify-center rounded-full sm:size-56">
      <Image
        ref={ref}
        key={dex}
        src={`${SPRITE_BASE}/${formatDexNumber(dex)}.png`}
        alt={revealed ? `Pokémon number ${dex}` : 'Hidden Pokémon silhouette'}
        width={192}
        height={192}
        priority
        draggable={false}
        onLoad={onReady}
        onError={onReady}
        className={`size-40 select-none transition-[filter] duration-300 sm:size-48 ${
          revealed ? 'brightness-100' : 'brightness-0'
        }`}
      />
    </div>
  )
}

export default PokemonSilhouette
