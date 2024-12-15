type SyncWerkerMethods<T extends object> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]>) => void
}
type AsyncWerkerMethods<T extends object> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]>) => Promise<ReturnType<T[TKey]>>
}

export type WerkerProps<T extends object> = SyncWerkerMethods<T> & {
  $transfer: (...transferables: Array<unknown>) => SyncWerkerMethods<T> & {
    $wait: AsyncWerkerMethods<T>
  }
  $wait: AsyncWerkerMethods<T> & {
    $transfer: (...transferables: Array<unknown>) => AsyncWerkerMethods<T>
  }
}
