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

export const metadata: Metadata = {
  title: 'Pokéguess',
  description: "Guess the Pokémon from its silhouette.",
  icons: { icon: '/favicon.ico' },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en" className={onest.variable}>
    <body className="bg-shell-dark min-h-screen">{children}</body>
  </html>
)

export default RootLayout
