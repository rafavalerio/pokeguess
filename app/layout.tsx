import type { Metadata } from 'next'
import { Onest } from 'next/font/google'

import './globals.css'

// Onest is a variable font, so no `weight` is listed: one file carries the whole
// 100-900 axis and the UI picks 400/500/600/700 off it. Asking for static
// weights instead would mean four files and four network requests.
const onest = Onest({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-onest',
})

// No `icons` entry: app/icon.png is picked up by Next's file convention, which
// emits the <link rel="icon"> with the right type and size hints on its own.
export const metadata: Metadata = {
  title: 'Pokéguess',
  description: "Guess the Pokémon from its silhouette.",
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en" className={onest.variable}>
    <body className="bg-shell-dark min-h-screen">{children}</body>
  </html>
)

export default RootLayout
