const MAX_UINT_32 = Math.pow(2, 32) - 1

type Codec = StructuralCodec | PrimitiveCodec

export class PrimitiveCodec<T = any> {
  structural = false as const
  test: (value: any) => boolean
  encode: (value: T) => Uint8Array
  decode: (buffer: Uint8Array) => T
  constructor({
    test,
    encode,
    decode,
  }: {
    test: PrimitiveCodec<T>['test']
    encode: PrimitiveCodec<T>['encode']
    decode: PrimitiveCodec<T>['decode']
  }) {
    this.test = test
    this.encode = encode
    this.decode = decode
  }
}

export class StructuralCodec<T = any> {
  structural = true as const
  test: (value: any) => boolean
  encode: (value: T) =>
    | {
        length?: never
        keys: Array<string>
        values: Array<any> | IterableIterator<any>
      }
    | {
        length: number
        keys?: never
        values: Array<any> | IterableIterator<any>
      }
  decode: () => { value: T; add(value: any, key: string | number): void }
  constructor({
    test,
    encode,
    decode,
  }: {
    test: StructuralCodec<T>['test']
    encode: StructuralCodec<T>['encode']
    decode: StructuralCodec<T>['decode']
  }) {
    this.test = test
    this.encode = encode
    this.decode = decode
  }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const JSONCodec = new PrimitiveCodec({
  test() {
    return true
  },
  encode(value) {
    return encoder.encode(JSON.stringify(value))
  },
  decode(value) {
    return JSON.parse(decoder.decode(value))
  },
})

export function createStreamProtocol(config: Array<Codec>, fallback: PrimitiveCodec = JSONCodec) {
  function getCodec(header: number) {
    return config[header - 1] ?? fallback
  }

  function encode(header: number, encoded: Uint8Array): Uint8Array {
    const buffer = new Uint8Array(1 + 4 + encoded.length)
    buffer[0] = header
    const view = new DataView(buffer.buffer)
    view.setUint32(1, encoded.length)
    if (encoded.length > MAX_UINT_32) throw `Tried to encode something larger than MAX_UINT_32`
    buffer.set(encoded, 5)
    return buffer
  }

  async function* createChunkGenerator(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<{ header: number; length: number; payload: Uint8Array }> {
    const reader = stream.getReader()
    let buffer = new Uint8Array(0)

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      // append new chunk to buffer
      buffer = concat(buffer, value!)

      while (buffer.length >= 5) {
        const header = buffer[0]!
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        const length = view.getUint32(1)

        if (buffer.length < 5 + length) break // wait for more data

        const payload = buffer.slice(5, 5 + length)

        yield { header, length, payload }

        buffer = buffer.slice(5 + length) // consume
      }
    }
  }

  const api = {
    *serialize(value: any): Generator<Uint8Array> {
      for (let i = 0; i < config.length; i++) {
        const codec = config[i]!
        if (codec.test(value)) {
          if (codec.structural) {
            const { keys, values, length } = codec.encode(value)
            // Encode paths as json
            yield encode(0x01 + i, JSONCodec.encode(length ?? keys))
            for (const value of values) {
              yield* api.serialize(value)
            }
          } else {
            yield encode(0x01 + i, codec.encode(value))
          }
          return
        }
      }
      throw new Error('No codec matched value')
    },

    async deserialize(stream: ReadableStream) {
      const generator = createChunkGenerator(stream)

      async function handleStructural({
        payload,
        codec,
      }: {
        payload: Uint8Array
        codec: StructuralCodec
      }) {
        const paths = JSONCodec.decode(payload) as Array<string> | number

        const { value, add } = codec.decode()

        const total = typeof paths === 'number' ? paths : paths.length

        for (let i = 0; i < total; i++) {
          const key = typeof paths === 'number' ? i : paths[i]
          const { value, done } = await generator.next()
          if (done) break

          const { payload, header } = value
          const codec = getCodec(header)

          if (codec.structural) {
            add(await handleStructural({ codec, payload }), key)
          } else {
            add(codec.decode(payload), key)
          }
        }

        return value
      }

      const {
        done,
        value: { payload, header },
      } = await generator.next()

      if (done) throw `Unexpected end`

      const codec = getCodec(header)

      if (codec.structural) {
        return handleStructural({ payload, codec })
      }

      return codec.decode(payload)
    },
  }

  return api
}

// helper to concatenate Uint8Arrays
function concat(
  a: Uint8Array<ArrayBuffer>,
  b: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(a.length + b.length)
  result.set(a)
  result.set(b, a.length)
  return result
}
