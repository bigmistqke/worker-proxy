export function createIdAllocator() {
  const freeIds = new Array<number>()
  let id = 0

  return {
    create() {
      if (freeIds.length) {
        return freeIds.pop()!
      }
      return id++
    },
    free(id: number) {
      freeIds.push(id)
    },
  }
}

export function createIdRegistry<T>() {
  const map = new Map<number, T>()
  const idFactory = createIdAllocator()

  return {
    register(value: T) {
      const id = idFactory.create()
      map.set(id, value)
      return id
    },
    free(id: number) {
      idFactory.free(id)
      return map.get(id)
    },
  }
}

export function defer<T = void>() {
  let resolve: (value: T) => void = null!
  let reject: (value: unknown) => void = null!
  return {
    promise: new Promise<T>((_resolve, _reject) => ((resolve = _resolve), (reject = _reject))),
    resolve,
    reject,
  }
}

export function createCommander<T extends object = object>(
  apply: (topics: Array<string>, args: Array<any>) => void,
): T {
  function _createCommander(
    topics: Array<string>,
    apply: (topics: Array<string>, args: Array<any>) => void,
  ): T {
    return new Proxy(function () {} as T, {
      get(_, topic) {
        if (typeof topic === 'symbol') return undefined
        return _createCommander([...topics, topic], apply)
      },
      apply(_, __, args) {
        return apply(topics, args)
      },
    })
  }
  return _createCommander([], apply)
}
