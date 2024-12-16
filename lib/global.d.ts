type SyncMethods<T extends Record<string, (...arg: Array<any>) => any>, Transferable = false> = {
  [TKey in keyof T]: (
    ...args: Transferable extends true
      ? [...Parameters<T[TKey]>, Array<unknown>]
      : Parameters<T[TKey]>
  ) => void
}
type AsyncMethods<T extends Record<string, (...arg: Array<any>) => any>, Transferable = false> = {
  [TKey in keyof T]: (
    ...args: Transferable extends true
      ? [...Parameters<T[TKey]>, Array<unknown>]
      : Parameters<T[TKey]>
  ) => Promise<ReturnType<T[TKey]>>
}

type WorkerProxy<T> = SyncMethods<ReturnType<T>> & {
  $transfer: SyncMethods<ReturnType<T>, true> & { $async: AsyncMethods<ReturnType<T>, true> }
  $async: AsyncMethods<ReturnType<T>> & {
    $transfer: SyncMethods<ReturnType<T>, true>
  }
  $on: {
    [TKey in keyof Parameters<T>[0]['self']]: (data: Parameters<T>[0]['self'][TKey]) => () => void
  }
  $link<U extends Omit<Parameters<T>[0], 'self'>, UKey extends keyof U>(
    name: UKey,
    worker: WorkerProxy<(...args: Array<unknown>) => Omit<U[UKey], '$async' | '$transfer'>>
  ): void
}

declare module '*?worker-proxy' {
  const workerApi: new <T>() => WorkerProxy<T>
  export default workerApi
}
