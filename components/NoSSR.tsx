import React from 'react'

import dynamic from 'next/dynamic'

type Props = {
  children: React.ReactNode
}

const NoSsr = ({ children }: Props) => <>{children}</>

export default dynamic(() => Promise.resolve(NoSsr), {
  ssr: false,
})
