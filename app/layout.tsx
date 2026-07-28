import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Pokéguess',
  description: "Guess the Pokémon from its silhouette.",
  icons: { icon: '/favicon.ico' },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <body className="bg-shell-dark min-h-screen">{children}</body>
  </html>
)

export default RootLayout
