'use client'

import { Home } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const Lamp = ({ className }: { className: string }) => (
  <span className={`rounded-full ${className}`} aria-hidden="true" />
)

type Props = {
  children: React.ReactNode
  // Only the game screen has somewhere to go "home" to; the menu and stats
  // screens are already home, so they render the shell without this prop.
  onHome?: () => void
}

// The screen's content changes height across views (menu vs. stats vs. a
// round vs. the win screen), which would otherwise snap instantly. Tracking
// the content's real height with a ResizeObserver and transitioning the
// wrapper to it gives every one of those swaps the same smooth resize,
// without hardcoding per-view heights. Starts at 'auto' so the very first
// paint (server and client alike) sizes to content with no observer needed.
const PokedexShell = ({ children, onHome }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    // entry.contentRect excludes the observed element's own padding, which
    // would undershoot the height by content's p-4/sm:p-5 and clip whatever
    // sits nearest the bottom (the Next/Start again button). offsetHeight
    // includes padding and border, matching the element's real rendered size.
    const observer = new ResizeObserver(() => setHeight(content.offsetHeight))
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="bg-shell border-shell-edge w-full max-w-md rounded-2xl border-4 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lamp className="bg-lamp-blue border-screen size-7 border-2" />
          <Lamp className="bg-lamp-amber size-3" />
          <Lamp className="bg-lamp-green size-3" />
        </div>
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            aria-label="Home"
            className="bg-button text-ink border-screen-sunk enabled:hover:border-shell enabled:hover:bg-screen-sunk focus-visible:ring-screen flex items-center justify-center rounded-lg border-2 px-3 py-2 transition duration-150 enabled:cursor-pointer focus-visible:ring-2 focus-visible:outline-none enabled:active:scale-[0.99]"
          >
            <Home className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div
        className="bg-screen overflow-hidden rounded-xl transition-[height] duration-300 ease-in-out"
        style={{ height }}
      >
        <div ref={contentRef} className="p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default PokedexShell
