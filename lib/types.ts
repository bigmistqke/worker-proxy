type SyncMethods<T extends Record<string, (...arg: Array<any>) => any>> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]>) => void
}
type AsyncMethods<T extends Record<string, (...arg: Array<any>) => any>> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]>) => Promise<ReturnType<T[TKey]>>
}

type PickRequired<T, U extends keyof T> = Required<Pick<T, U>> & Omit<T, U>

export type WerkerProps<T extends Record<string, Record<string, (...arg: Array<any>) => any>>> =
  PickRequired<
    {
      [TKey in keyof T]?: SyncMethods<T[TKey]> & {
        $transfer: (...transferables: Array<any>) => SyncMethods<T[TKey]> & {
          $async: AsyncMethods<T[TKey]>
        }
        $async: AsyncMethods<T[TKey]> & {
          $transfer: (...transferables: Array<any>) => AsyncMethods<T[TKey]>
        }
      }
    },
    'self'
  >
