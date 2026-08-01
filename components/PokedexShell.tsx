'use client'

import { useEffect, useRef, useState } from 'react'

const Lamp = ({ className }: { className: string }) => (
  <span className={`rounded-full ${className}`} aria-hidden="true" />
)

// The screen's content changes height across views (menu vs. stats vs. a
// round vs. the win screen), which would otherwise snap instantly. Tracking
// the content's real height with a ResizeObserver and transitioning the
// wrapper to it gives every one of those swaps the same smooth resize,
// without hardcoding per-view heights. Starts at 'auto' so the very first
// paint (server and client alike) sizes to content with no observer needed.
const PokedexShell = ({ children }: { children: React.ReactNode }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height)
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="bg-shell border-shell-edge w-full max-w-md rounded-2xl border-4 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Lamp className="bg-lamp-blue border-screen size-7 border-2" />
        <Lamp className="bg-lamp-amber size-3" />
        <Lamp className="bg-lamp-green size-3" />
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
