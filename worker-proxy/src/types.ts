import { $CALLBACK } from './constants'

export type $Transfer<T = Array<any>, U = Array<Transferable>> = T & {
  $transferables: U
}

export type $Callback<T = Fn> = T & { [$CALLBACK]: number }

export type Fn = (...arg: Array<any>) => any

export type SyncMethods<T extends Record<string, Fn>> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]> | [$Transfer<Parameters<T[TKey]>>]) => void
}

export type AsyncMethods<T extends Record<string, Fn>> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]>) => Promise<ReturnType<T[TKey]>>
}

export type WorkerProps<T extends Record<string, Fn>> = SyncMethods<T> & {
  $async: AsyncMethods<T>
}

export type WorkerProxy<T> = T extends Record<string, Fn>
  ? SyncMethods<T> & {
      $async: AsyncMethods<T>
    }
  : never

/** Branded `MessagePort` */
export type WorkerProxyPort<T> = MessagePort & { $: T }
