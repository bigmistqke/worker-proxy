type SyncWerkerMethods<T> = {
  [TKey in keyof ReturnType<T>]: (...args: Parameters<ReturnType<T>[TKey]>) => void
}
type AsyncWerkerMethods<T> = {
  [TKey in keyof ReturnType<T>]: (
    ...args: Parameters<ReturnType<T>[TKey]>
  ) => Promise<ReturnType<ReturnType<T>[TKey]>>
}

type Transfer<T> = (
  ...transferables: Array<any>
) => SyncWerkerMethods<T> & { $wait: AsyncWerkerMethods<T> }
type WaitMethod<T> = AsyncWerkerMethods<T> & {
  $transfer: (...transferables: Array<any>) => SyncWerkerMethods<T>
}
type Werker<T> = SyncWerkerMethods<T> & {
  $transfer: Transfer<T>
  $wait: WaitMethod<T>
  $on: {
    [TKey in keyof Parameters<T>[0]['self']]: (data: Parameters<T>[0][TKey]) => () => void
  }
  $link<U extends Omit<Parameters<T>[0], 'self'>, UKey extends keyof U>(
    name: UKey,
    worker: Werker<(...args: Array<unknown>) => U[UKey]>
  ): void
}

declare module '*?werker' {
  const workerApi: new <T>() => Werker<T>
  export default workerApi
}
