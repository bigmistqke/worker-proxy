export type TransferProps<T extends object> = {
  [TKey in keyof T]: T[TKey] & { transfer: (...args: Array<any>) => T[TKey] }
}
