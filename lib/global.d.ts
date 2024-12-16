type SyncMethods<T> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]>) => void
}
type AsyncMethods<T> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]>) => Promise<ReturnType<T[TKey]>>
}

type Werker<T> = SyncMethods<ReturnType<T>> & {
  $transfer: (
    ...transferables: Array<any>
  ) => SyncMethods<ReturnType<T>> & { $async: AsyncMethods<ReturnType<T>> }
  $async: AsyncMethods<ReturnType<T>> & {
    $transfer: (...transferables: Array<any>) => SyncMethods<ReturnType<T>>
  }
  $on: {
    [TKey in keyof Parameters<T>[0]['self']]: (data: Parameters<T>[0][TKey]) => () => void
  }
  $link<U extends Omit<Parameters<T>[0], 'self'>, UKey extends keyof U>(
    name: UKey,
    worker: Werker<(...args: Array<unknown>) => Omit<U[UKey], '$async' | '$transfer'>>
  ): void
}

declare module '*?werker' {
  const workerApi: new <T>() => Werker<T>
  export default workerApi
}
