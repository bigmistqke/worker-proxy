declare module '*?worker-proxy' {
  type WorkerProxyPort<T> = MessagePort & { $: T }
  type $Transfer = Array<Transferable> & { $transfer: true }

  type SyncMethods<T extends Record<string, (...arg: Array<any>) => any>> = {
    [TKey in keyof T]: (
      ...args: Parameters<T[TKey]> | [Transferable<Parameters<T[TKey]>, any>]
    ) => void
  }
  type AsyncMethods<T extends Record<string, (...arg: Array<any>) => any>> = {
    [TKey in keyof T]: (
      ...args: Parameters<T[TKey]> | [Transferable<Parameters<T[TKey]>, unknown>]
    ) => Promise<ReturnType<T[TKey]>>
  }
  type WorkerProxy<Methods, Props> = SyncMethods<Methods> & {
    $async: AsyncMethods<Methods>
    $on: {
      [TKey in keyof Props]: (data: Props[TKey]) => () => void
    }
    $port: () => WorkerProxyPort<Methods>
  }
  const workerApi: new <T>() => T extends (...args: Array<any>) => infer U
    ? WorkerProxy<U, Parameters<T>[0]>
    : WorkerProxy<T>
  export default workerApi
}
