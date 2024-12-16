type $Transfer<T, U extends Array<Transferable> = Array<Transferable>> = [T, U] & {
  $transfer: true
}
export type Fn = (...arg: Array<any>) => any

export type SyncMethods<T extends Record<string, Fn>> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]> | [$Transfer<Parameters<T[TKey]>>]) => void
}

export type AsyncMethods<T extends Record<string, Fn>> = {
  [TKey in keyof T]: (
    ...args: Parameters<T[TKey]> | [$Transfer<Parameters<T[TKey]>>]
  ) => Promise<ReturnType<T[TKey]>>
}

export type WorkerProps<T extends Record<string, Fn>> = SyncMethods<T> & {
  $async: AsyncMethods<T>
}

export type WorkerProxy<T extends Fn = Fn> = SyncMethods<ReturnType<T>> & {
  $async: AsyncMethods<ReturnType<T>>
  $on: {
    [TKey in keyof Parameters<T>[0]]: (data: Parameters<T>[0][TKey]) => () => void
  }
}

/** Branded `MessagePort` */
export type WorkerProxyPort<T> = MessagePort & { $: T }
