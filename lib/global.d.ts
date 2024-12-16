declare module '*?worker-proxy' {
  type $MessagePort<T> = MessagePort & { $: T }
  type Transferable<T, U> = [T, U] & { $transfer: true }

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
  type WorkerProxy<T> = SyncMethods<ReturnType<T>> & {
    $async: AsyncMethods<ReturnType<T>>
    $on: {
      [TKey in keyof Parameters<T>[0]]: (data: Parameters<T>[0][TKey]) => () => void
    }
    $port: () => $MessagePort<T>
  }
  const workerApi: new <T>() => WorkerProxy<T>
  export default workerApi
}
