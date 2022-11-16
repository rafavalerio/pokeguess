import Image from 'next/image'
import styled from 'styled-components'

import formatPokemonNumber from '../utils/formatPokemonNumber'

const ImageObject = styled(Image)<{ isLoading?: boolean; isHidden?: boolean }>`
  opacity: ${({ isLoading }) => (isLoading ? 0 : 1)};
  filter: ${({ isHidden }) => (isHidden ? 'brightness(0)' : 'none')};

  transition: filter 0.2s ease-in-out;

  -webkit-user-drag: none;
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
`

type Props = {
  number: number
  onLoad: () => void
  loading: boolean
  isHidden: boolean
}

const PokemonImage = ({ number, onLoad, loading, isHidden }: Props) => {
  const URL =
    'https://raw.githubusercontent.com/rafavalerio/pokemon-sprites/master/images'

  return (
    <ImageObject
      src={`${URL}/${formatPokemonNumber(number)}.png`}
      alt='pokemon'
      width={300}
      height={300}
      onLoad={onLoad}
      isLoading={loading}
      isHidden={isHidden}
      draggable={false}
    />
  )
}

export default PokemonImage
