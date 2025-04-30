import type { $Transfer } from '@bigmistqke/worker-proxy'

// This is needed to circumvent typescript's limitation on
// augmenting abstract modules in a `declare global` block
// which prevents us from importing the correct symbols.
declare global {
  namespace WorkerProxySymbols {
    export { $Transfer }
  }
}
