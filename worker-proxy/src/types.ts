import { $CALLBACK } from './constants'

export type $Transfer<T = Array<any>, U = Array<Transferable>> = T & {
  $transferables: U
}

export type $Callback<T = Fn> = T & { [$CALLBACK]: number }

export type Fn = (...arg: Array<any>) => any

interface Method<T extends Fn> {
  (...args: Parameters<T> | [$Transfer<Parameters<T>>]): void
  $: (...args: Parameters<T> | [$Transfer<Parameters<T>>]) => Promise<ReturnType<T>>
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

export type WorkerProxy<T> = T extends Fn
  ? Method<T>
  : T extends readonly [any, ...any[]] // is it a tuple?
  ? { [K in keyof T]: WorkerProxy<T[K]> } // preserve tuple structure
  : // To prevent error: `Type instantiation is excessively deep and possibly infinite.`
  isObject<T> extends true
  ? // Filter branches that lead to no method
    HasMethod<T> extends false
    ? never
    : {
        [TKey in keyof FilterMethods<T>]: WorkerProxy<T[TKey]>
      }
  : never

/** Branded `MessagePort` */
export type WorkerProxyPort<T> = MessagePort & { $: T }

export type Api =
  | {
      [key: string]: Fn | Api
    }
  | Array<Fn | Api>
  | object
