import Image from 'next/image'
import styled from 'styled-components'
import { random, shuffle } from 'lodash'

import pokeball from '../public/images/pokeball.png'

import { pokemonNames } from '../utils/pokemonNames'
import { useState } from 'react'
import NoSSR from './NoSSR'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`

const PokemonWrapper = styled.div<{ hidden?: boolean }>`
  position: relative;
  display: flex;
  background: #eee;
  border-radius: 50%;
  cursor: pointer;
  margin: 1em;

  &:hover {
    img {
      scale: 1.3;
    }
  }
`

const PokemonInfo = styled.div<{ blurred?: boolean }>`
  filter: ${({ blurred }) => (blurred ? 'blur(10px)' : 'none')};
`

const Options = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;

  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
  }
`

const Actions = styled.div`
  display: flex;
  flex: 1;
  margin: 1em;
  align-items: center;
`

const Button = styled.button<{ primary?: boolean; small?: boolean }>`
  padding: 0.8em 1em;
  margin: 0.5em;
  border-radius: 0.2em;
  border: none;
  background: ${(props) => (props.primary ? '#0af' : '#eee')};
  cursor: pointer;
  font-size: ${(props) => (props.small ? '0.9em' : '1em')};

  &:hover {
    background: ${(props) => (props.primary ? '#0cf' : '#ddd')};
  }
`

const Guess = styled(Button)<{ correct?: boolean }>`
  background: ${({ correct }) => (correct ? '#0f0' : '#eee')};

  &:hover {
    background: ${({ correct }) => (correct ? '#0f0' : '#ddd')};
  }
`

const PokemonImage = styled(Image)<{ isLoading?: boolean; isHidden?: boolean }>`
  opacity: ${({ isLoading }) => (isLoading ? 0 : 1)};
  filter: ${({ isHidden }) => (isHidden ? 'brightness(0)' : 'none')};
`

const Loading = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: pulse 0.5s ease-in-out infinite;

  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
  }
`

const formatPokemonNumber = (number: number) => {
  if (number < 10) {
    return `00${number}`
  } else if (number < 100) {
    return `0${number}`
  } else {
    return number
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const generateOptions = (correctAnswer: number) => {
  const options = [correctAnswer]
  while (options.length < 4) {
    const randomPokemon = random(1, 905)
    if (!options.includes(randomPokemon)) {
      options.push(randomPokemon)
    }
  }
  return shuffle(options)
}

const App = () => {
  const URL =
    'https://raw.githubusercontent.com/rafavalerio/pokemon-sprites/master/images'
  const [nameHidden, setNameHidden] = useState(true)
  const [randomPokemon, setRandomPokemon] = useState(random(1, 905))
  const [options, setOptions] = useState(generateOptions(randomPokemon))
  const [loading, setLoading] = useState(true)

  const reset = async () => {
    setLoading(true)
    const newRandomPokemon = random(1, 905)
    setNameHidden(true)
    await sleep(150)
    setRandomPokemon(newRandomPokemon)
    setOptions(generateOptions(newRandomPokemon))
  }

  return (
    <NoSSR>
      <Wrapper>
        <h1>Pokéguess</h1>

        <PokemonWrapper>
          {loading && (
            <Loading>
              <Image src={pokeball} alt='loading' width={50} height={50} />
            </Loading>
          )}
          <PokemonImage
            src={`${URL}/${formatPokemonNumber(randomPokemon)}.png`}
            alt='pokemon'
            width={300}
            height={300}
            onLoad={() => setLoading(false)}
            isLoading={loading}
            isHidden={nameHidden}
          />
        </PokemonWrapper>

        <PokemonInfo blurred={nameHidden}>
          <h1>
            #{randomPokemon} | {pokemonNames[randomPokemon - 1]}
          </h1>
        </PokemonInfo>

        <Options>
          {options.map((option) => (
            <Guess
              key={option}
              small
              onClick={() => {
                if (option === randomPokemon) {
                  setNameHidden(false)
                }
              }}
              correct={option === randomPokemon && !nameHidden}
            >
              {pokemonNames[option - 1]}
            </Guess>
          ))}
        </Options>

        <Actions>
          <Button onClick={() => reset()} primary>
            NEXT
          </Button>
          <Button onClick={() => setNameHidden(false)} disabled={!nameHidden}>
            REVEAL
          </Button>
        </Actions>
      </Wrapper>
    </NoSSR>
  )
}

export default App
