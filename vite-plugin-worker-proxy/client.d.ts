declare module '*?worker-proxy' {
  type Fn = (...arg: Array<any>) => any

  type SyncMethod<T extends Fn> = (
    ...args: Parameters<T> | [WorkerProxySymbols.$Transfer<Parameters<T>>]
  ) => void
  export type SyncMethods<T extends Record<string, Fn>> = {
    [TKey in keyof T as T[TKey] extends Fn ? TKey : never]: SyncMethod<T[TKey]>
  }

  type AsyncMethod<T extends Fn> = (...args: Parameters<T>) => Promise<ReturnType<T>>
  export type AsyncMethods<T extends Record<string, any>> = {
    [TKey in keyof T as T[TKey] extends Fn ? TKey : never]: AsyncMethod<T[TKey]>
  }

  export type WorkerProps<T extends Record<string, Fn>> = SyncMethods<T> & {
    $async: AsyncMethods<T>
  }

  type FilterMethods<T> = {
    [TKey in keyof T as WorkerProxy<T[TKey]> extends never ? never : TKey]: T[TKey]
  }

  // To prevent error: `Type instantiation is excessively deep and possibly infinite.`
  type isObject<T> = T extends object ? true : false

  type HasMethod<T> = T extends object
    ? {
        [K in keyof T]: T[K] extends Fn ? true : HasMethod<T[K]>
      }[keyof T] extends false
      ? false
      : true
    : false

  type WorkerProxy<T> = T extends Fn
    ? SyncMethod<T>
    : T extends readonly [any, ...any[]]
    ? {
        [TKey in keyof FilterMethods<T>]: WorkerProxy<T[TKey]>
      } & { $async: AsyncMethods<FilterMethods<T>> }
    : // To prevent error: `Type instantiation is excessively deep and possibly infinite.`
    isObject<T> extends true
    ? // Filter branches that lead to no method
      HasMethod<T> extends false
      ? never
      : {
          [TKey in keyof FilterMethods<T>]: WorkerProxy<T[TKey]>
        } & { $async: AsyncMethods<FilterMethods<T>> }
    : never

  const workerApi: new <T>() => WorkerProxy<T>
  export default workerApi
}
