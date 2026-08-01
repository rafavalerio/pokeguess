import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement ResizeObserver. PokedexShell only uses it to drive
// a non-essential height transition, so a no-op stub is enough to keep it
// from throwing in tests that don't care about layout measurements.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
