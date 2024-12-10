declare module '*?werker' {
  const workerApi: new <T>() => { [TKey in keyof ReturnType<T>]: ReturnType<T>[TKey] } & {
    on: {
      [TKey in keyof Parameters<T>[0]]: (data: Parameters<T>[0][TKey]) => () => void
    }
  }
  export default workerApi
}
