import dynamic from 'next/dynamic'
import React from 'react'

type Props = {
  children: React.ReactNode
}

const NoSsr = ({ children }: Props) => <>{children}</>

export default dynamic(() => Promise.resolve(NoSsr), {
  ssr: false,
})
