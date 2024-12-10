type WerkerMethods<T> = {
  [TKey in keyof ReturnType<T>]: ReturnType<T>[TKey]
}
type Werker<T> = WerkerMethods<T> & {
  on: {
    [TKey in keyof Parameters<T>[0]]: (data: Parameters<T>[0][TKey]) => () => void
  }
  link<U extends Parameters<T>[1], UKey extends keyof U>(
    name: UKey,
    worker: Werker<(...args: Array<unknown>) => U[UKey]>
  ): void
}

declare module '*?werker' {
  const workerApi: new <T>() => Werker<T>
  export default workerApi
}
