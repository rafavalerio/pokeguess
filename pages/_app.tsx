import '../styles/globals.css'
import type { AppProps } from 'next/app'
import styled from 'styled-components'

const FullPageWrapper = styled.div`
  width: 100%;
  height: 100vh;
`

export default function App({ Component, pageProps }: AppProps) {
  return (
    <FullPageWrapper>
      <Component {...pageProps} />
    </FullPageWrapper>
  )
}
