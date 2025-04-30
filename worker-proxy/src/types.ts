import { $CALLBACK, $TRANSFER, $WORKER } from './constants'

export type $Transfer<T = Array<any>, U = Array<Transferable>> = T & {
  [$TRANSFER]: U
}

export type $Callback<T = Fn> = T & { [$CALLBACK]: number }

export type Fn = (...arg: Array<any>) => any

interface WorkerMethod<T extends Fn> {
  (...args: Parameters<T> | [$Transfer<Parameters<T>>]): void
  $: (...args: Parameters<T> | [$Transfer<Parameters<T>>]) => Promise<ReturnType<T>>
}

type FilterWorkerProxyNode<T> = {
  [TKey in keyof T as WorkerProxyNode<T[TKey]> extends never ? never : TKey]: T[TKey]
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

export type WorkerProxyNode<T> = T extends Fn
  ? WorkerMethod<T>
  : T extends readonly [any, ...any[]] // is it a tuple?
  ? { [K in keyof T]: WorkerProxyNode<T[K]> } // preserve tuple structure
  : // To prevent error: `Type instantiation is excessively deep and possibly infinite.`
  isObject<T> extends true
  ? // Filter branches that lead to no method
    HasMethod<T> extends false
    ? never
    : {
        [TKey in keyof FilterWorkerProxyNode<T>]: WorkerProxyNode<T[TKey]>
      }
  : never

export type WorkerProxy<T extends object> = WorkerProxyNode<T> & { [$WORKER]: Worker }

/** Branded `MessagePort` */
export type WorkerProxyPort<T extends object> = MessagePort & { [$WORKER]: WorkerProxy<T> }
