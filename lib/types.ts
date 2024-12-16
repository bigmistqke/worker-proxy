type SyncMethods<T extends Record<string, (...arg: Array<any>) => any>, Transferable = false> = {
  [TKey in keyof T]: (
    ...args: Transferable extends true
      ? [...Parameters<T[TKey]>, Array<unknown>]
      : Parameters<T[TKey]>
  ) => void
}
type AsyncMethods<T extends Record<string, (...arg: Array<any>) => any>, Transferable = false> = {
  [TKey in keyof T]: (
    ...args: Transferable extends true
      ? [...Parameters<T[TKey]>, Array<unknown>]
      : Parameters<T[TKey]>
  ) => Promise<ReturnType<T[TKey]>>
}

type PickRequired<T, U extends keyof T> = Required<Pick<T, U>> & Omit<T, U>

export type WorkerProps<T extends Record<string, Record<string, (...arg: Array<any>) => any>>> =
  PickRequired<
    {
      [TKey in keyof T]?: SyncMethods<T[TKey]> & {
        $transfer: SyncMethods<T[TKey], true> & {
          $async: AsyncMethods<T[TKey], true>
        }
        $async: AsyncMethods<T[TKey]> & {
          $transfer: AsyncMethods<T[TKey], true>
        }
      }
    },
    'self'
  >
