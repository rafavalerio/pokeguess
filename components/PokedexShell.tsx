const Lamp = ({ className }: { className: string }) => (
  <span className={`rounded-full ${className}`} aria-hidden="true" />
)

const PokedexShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-shell border-shell-edge w-full max-w-md rounded-2xl border-4 p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <Lamp className="bg-lamp-blue border-screen size-7 border-2" />
      <Lamp className="bg-lamp-amber size-3" />
      <Lamp className="bg-lamp-green size-3" />
    </div>
    <div className="bg-screen rounded-xl p-4 sm:p-5">{children}</div>
  </div>
)

export default PokedexShell
