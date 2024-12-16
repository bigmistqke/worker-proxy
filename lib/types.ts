export type Fn = (...arg: Array<any>) => any

export type SyncMethods<T extends Record<string, Fn>, Transferable = false> = {
  [TKey in keyof T]: (
    ...args: Transferable extends true
      ? [...Parameters<T[TKey]>, Array<unknown>]
      : Parameters<T[TKey]>
  ) => void
}

export type AsyncMethods<T extends Record<string, Fn>, Transferable = false> = {
  [TKey in keyof T]: (
    ...args: Transferable extends true
      ? [...Parameters<T[TKey]>, Array<unknown>]
      : Parameters<T[TKey]>
  ) => Promise<ReturnType<T[TKey]>>
}

export type WorkerProps<T extends Record<string, Fn>> = SyncMethods<T> & {
  $transfer: SyncMethods<T, true> & {
    $async: AsyncMethods<T, true>
  }
  $async: AsyncMethods<T> & {
    $transfer: AsyncMethods<T, true>
  }
}

export type WorkerProxy<T extends Fn = Fn> = SyncMethods<ReturnType<T>> & {
  $transfer: SyncMethods<ReturnType<T>, true> & { $async: AsyncMethods<ReturnType<T>, true> }
  $async: AsyncMethods<ReturnType<T>> & {
    $transfer: SyncMethods<ReturnType<T>, true>
  }
  $on: {
    [TKey in keyof Parameters<T>[0]]: (data: Parameters<T>[0][TKey]) => () => void
  }
}

/** Branded `MessagePort` */
export type $MessagePort<T> = MessagePort & { $: T }
