import { useState, useEffect } from 'react'

import { Button, Space, Row, Col, Typography } from 'antd'
import { random, shuffle } from 'lodash'
import Image from 'next/image'
import styled from 'styled-components'

import background from '../public/images/dot.png'
import pokeball from '../public/images/pokeball.png'
import { pokemonNames } from '../utils/pokemonNames'

import PokemonImage from './PokemonImage'

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${`url(${background.src}) repeat`};
  height: 100vh;
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
  const [isHidden, setIsHidden] = useState(true)
  const [randomPokemon, setRandomPokemon] = useState<number | undefined>(
    undefined
  )
  const [options, setOptions] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)

  useEffect(() => {
    const randomNumber = random(1, 905)
    setRandomPokemon(randomNumber)
    setOptions(generateOptions(randomNumber))
    localStorage.getItem('bestStreak') &&
      setBestStreak(Number(localStorage.getItem('bestStreak')))
  }, [])

  const reset = async () => {
    setLoading(true)
    const newRandomPokemon = random(1, 905)
    setIsHidden(true)
    await sleep(150)
    setRandomPokemon(newRandomPokemon)
    setOptions(generateOptions(newRandomPokemon))
  }

  return (
    <Wrapper>
      <Typography.Title>Pokéguess</Typography.Title>
      <Space>
        <Typography.Text>Streak: {streak}</Typography.Text>|
        <Typography.Text>Best Streak: {bestStreak}</Typography.Text>
      </Space>

      <PokemonWrapper>
        {loading && (
          <Loading>
            <Image src={pokeball} alt='loading' width={50} height={50} />
          </Loading>
        )}
        {randomPokemon && (
          <PokemonImage
            number={randomPokemon}
            onLoad={() => setLoading(false)}
            loading={loading}
            isHidden={isHidden}
          />
        )}
      </PokemonWrapper>

      {randomPokemon && (
        <PokemonInfo blurred={isHidden}>
          <h1>
            #{randomPokemon} | {pokemonNames[randomPokemon - 1]}
          </h1>
        </PokemonInfo>
      )}

      <Row
        gutter={[8, 8]}
        justify='center'
        align='middle'
        style={{ margin: 10 }}
      >
        {options.map((option) => (
          <Col key={option} span={12}>
            <Button
              onClick={() => {
                if (option === randomPokemon) {
                  setStreak(streak + 1)
                } else {
                  const newBestStreak = Math.max(streak, bestStreak)
                  setBestStreak(newBestStreak)
                  localStorage.setItem('bestStreak', String(newBestStreak))
                  setStreak(0)
                }
                setIsHidden(false)
              }}
              disabled={!isHidden}
              block
            >
              {pokemonNames[option - 1]}
            </Button>
          </Col>
        ))}
      </Row>

      <Space size='middle' style={{ margin: 15 }}>
        <Button onClick={() => reset()} type='primary'>
          NEXT
        </Button>
      </Space>
    </Wrapper>
  )
}

export default App
