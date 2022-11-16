const formatPokemonNumber = (number: number) => {
  if (number < 10) {
    return `00${number}`
  } else if (number < 100) {
    return `0${number}`
  } else {
    return number
  }
}

export default formatPokemonNumber
