import { streamToAsyncIterable } from 'src/utils'
import {
  GeneratorCodec,
  PrimitiveCodec,
  StructuralCodec,
  createStreamCodec,
} from '../src/stream/encoding'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const TYPED_ARRAYS = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
] as const

type InstanceOf<TConstructor> = TConstructor extends new (...args: Array<any>) => infer T
  ? T
  : never

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  )
}

export const codec = createStreamCodec([
  new GeneratorCodec<ReadableStream>({
    test(value) {
      return value instanceof ReadableStream
    },
    async *encode(value) {
      for await (const chunk of streamToAsyncIterable(value)) {
        yield chunk
      }
    },
    async *decode() {
      let controller: ReadableStreamDefaultController = null!
      try {
        const stream = new ReadableStream({
          start(_controller) {
            controller = _controller
          },
        })
        while (true) {
          controller.enqueue(yield stream)
        }
      } finally {
        controller.close()
      }
    },
  }),
  new StructuralCodec<Array<unknown>>({
    test(value) {
      return Array.isArray(value)
    },
    encode(value) {
      return {
        length: value.length,
        values: [...value],
      }
    },
    decode() {
      const value: Array<any> = []
      return {
        value,
        set(item, key) {
          value[key] = item
        },
      }
    },
  }),
  new StructuralCodec<Record<string, any>>({
    test(value) {
      return isPlainObject(value)
    },
    encode(value) {
      return {
        keys: Object.keys(value),
        values: Object.values(value),
      }
    },
    decode() {
      const value: Record<string, any> = {}
      return {
        value,
        set(item, key) {
          value[key] = item
        },
      }
    },
  }),
  new StructuralCodec<Set<any>>({
    test(value) {
      return value instanceof Set
    },
    encode(value) {
      return {
        length: value.size,
        values: value.values(),
      }
    },
    decode() {
      const value = new Set()
      return {
        value,
        set(item) {
          value.add(item)
        },
      }
    },
  }),
  new PrimitiveCodec<string>({
    test(value) {
      return typeof value === 'string'
    },
    encode(value) {
      return new Uint8Array(encoder.encode(value))
    },
    decode(value) {
      return decoder.decode(value)
    },
  }),
  new PrimitiveCodec<number>({
    test(value) {
      return typeof value === 'number'
    },
    encode(value) {
      return new Uint8Array(encoder.encode(value.toString()))
    },
    decode(value) {
      return +decoder.decode(value)
    },
  }),
  new PrimitiveCodec<ArrayBuffer>({
    test(value) {
      return value instanceof ArrayBuffer
    },
    encode(value) {
      return new Uint8Array(value)
    },
    decode(value) {
      return value.buffer
    },
  }),
  ...TYPED_ARRAYS.map(Constructor => {
    return new PrimitiveCodec<InstanceOf<typeof Constructor>>({
      test(value: any) {
        return value instanceof Constructor
      },
      encode(value: any) {
        return new Uint8Array(value.buffer)
      },
      decode(value: any) {
        return new Constructor(value.buffer)
      },
    })
  }),
])
