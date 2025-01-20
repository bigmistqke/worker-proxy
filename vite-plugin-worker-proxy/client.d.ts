declare module '*?worker-proxy' {
  type WorkerProxyPort<T> = MessagePort & { $: T }
  type $Transfer<T = Array<any>, U = Array<Transferable>> = T & {
    $transferables: U
  }

  type Fn = (...arg: Array<any>) => any

  type SyncMethods<T extends Record<string, Fn>> = {
    [TKey in keyof T]: (...args: Parameters<T[TKey]> | [$Transfer<Parameters<T[TKey]>>]) => void
  }
  type AsyncMethods<T extends Record<string, Fn>> = {
    [TKey in keyof T]: (
      ...args: Parameters<T[TKey]> | [$Transfer<Parameters<T[TKey]>>]
    ) => Promise<ReturnType<T[TKey]>>
  }
  type WorkerProxy<Methods extends Record<string, Fn>, Props = unknown> = SyncMethods<Methods> & {
    $async: AsyncMethods<Methods>
    $on: {
      [TKey in keyof Props]: (data: Props[TKey]) => () => void
    }
    $port: () => WorkerProxyPort<Methods>
  }
  const workerApi: new <T>() => T extends Record<string, Fn> ? WorkerProxy<T> : never
  export default workerApi
}
