const MAX_UINT_32 = Math.pow(2, 32) - 1
const encoder = new TextEncoder()
const decoder = new TextDecoder()

type Codec = StructuralCodec | PrimitiveCodec | GeneratorCodec

export class PrimitiveCodec<T = any> {
  type = 'primitive' as const
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
  type = 'structural' as const
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

export class GeneratorCodec<T = any> {
  type = 'generator' as const
  test: (value: any) => boolean
  encode: (value: T) => AsyncGenerator<Uint8Array>
  decode: (value: Uint8Array) => AsyncGenerator<T, unknown, Uint8Array>
  constructor({
    test,
    encode,
    decode,
  }: {
    test: GeneratorCodec<T>['test']
    encode: GeneratorCodec<T>['encode']
    decode: GeneratorCodec<T>['decode']
  }) {
    this.test = test
    this.encode = encode
    this.decode = decode
  }
}

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
  function getCodecFromHeader(header: number) {
    return config[header - 1] ?? fallback
  }

  function getCodecFromValue(value: any) {
    for (let index = 0; index < config.length; index++) {
      const codec = config[index]!
      if (codec.test(value)) {
        return { codec, header: 0x01 + index }
      }
    }
    return { codec: fallback, header: 0x01 + config.length }
  }

  const DEFAULT_PREFIX = 1 + 1 + 4
  function pack(header: number, encoded: Uint8Array): Uint8Array {
    const buffer = new Uint8Array(DEFAULT_PREFIX + encoded.length)
    buffer[0] = 0x01
    buffer[1] = header
    const view = new DataView(buffer.buffer)
    view.setUint32(2, encoded.length)
    if (encoded.length > MAX_UINT_32) throw `Tried to encode something larger than MAX_UINT_32`
    buffer.set(encoded, DEFAULT_PREFIX)
    return buffer
  }

  const CHUNK_PREFIX = 1 + 1 + 4 + 4
  function packChunk(id: number, header: number, encoded: Uint8Array): Uint8Array {
    const buffer = new Uint8Array(CHUNK_PREFIX + encoded.length)
    buffer[0] = 0x02
    buffer[1] = header
    const view = new DataView(buffer.buffer)
    view.setUint32(2, encoded.length)
    view.setUint32(6, id)
    if (encoded.length > MAX_UINT_32) throw `Tried to encode something larger than MAX_UINT_32`
    buffer.set(encoded, CHUNK_PREFIX)
    return buffer
  }

  function unpack(buffer: Uint8Array) {
    const kind = buffer[0]
    const header = buffer[1]
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const length = view.getUint32(2)
    const prefix = kind === 0x01 ? DEFAULT_PREFIX : CHUNK_PREFIX
    const payload =
      buffer.length < prefix + length ? undefined : buffer.slice(prefix, prefix + length)
    const rest = !payload ? undefined : buffer.slice(prefix + length)

    switch (kind) {
      case 0x01:
        return {
          kind,
          header,
          length,
          payload,
          rest,
        }
      case 0x02:
        return {
          kind,
          header,
          length,
          id: view.getUint32(6),
          payload,
          rest,
        }
    }

    throw `Incorrect kind ${kind}`
  }

  async function* createChunkGenerator(stream: ReadableStream<Uint8Array>): AsyncGenerator<{
    kind: number
    header: number
    length: number
    payload: Uint8Array
    id?: number
  }> {
    const reader = stream.getReader()
    let buffer = new Uint8Array(0)

    while (true) {
      const { value, done } = await reader.read()

      if (done) break

      // append new chunk to buffer
      buffer = concat(buffer, value!)

      while (buffer.length >= DEFAULT_PREFIX) {
        const { kind, header, length, payload, rest, id } = unpack(buffer)

        if (!payload || !rest) break

        yield { kind, header, length, payload, id }

        buffer = rest
      }
    }
  }

  let streamId = 0
  const streams: Record<string, ReadableStreamDefaultController> = {}
  const generators = new Array<{
    generator: AsyncGenerator<Uint8Array>
    id: number
    codec: GeneratorCodec
    header: number
  }>()

  const api = {
    *serialize(value: any): Generator<Uint8Array | (() => AsyncGenerator<Uint8Array>)> {
      const { codec, header } = getCodecFromValue(value)

      if (codec.type === 'structural') {
        const { keys, values, length } = codec.encode(value)

        yield pack(header, JSONCodec.encode(length ?? keys))
        for (const value of values) {
          for (const chunk of api.serialize(value)) {
            yield chunk
          }
        }
      } else if (codec.type === 'generator') {
        const generator = codec.encode(value)
        const id = streamId++
        generators.push({ generator, codec, id, header })

        // Emit declaration
        yield pack(header, JSONCodec.encode({ id }))
      } else {
        // Primitive case — just yield the encoded value
        yield pack(header, codec.encode(value))
      }

      yield async function* () {
        // Phase 2: Stream the live generators
        for (const { generator, id, header } of generators) {
          for await (const value of generator) {
            yield packChunk(id, header, value)
          }
        }
      }
    },
    async *deserialize(stream: ReadableStream) {
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
          const codec = getCodecFromHeader(header)

          if (codec.type === 'structural') {
            add(await handleStructural({ codec, payload }), key)
          } else if (codec.type === 'generator') {
            add(await handleGenerator({ payload, codec }), key)
          } else {
            add(codec.decode(payload), key)
          }
        }

        return value
      }

      async function handleGenerator({
        payload,
        codec,
      }: {
        payload: Uint8Array
        codec: GeneratorCodec
      }) {
        const { id } = JSONCodec.decode(payload)
        let controller: ReadableStreamDefaultController = null!
        const stream = new ReadableStream({
          start(_controller) {
            controller = _controller
          },
        })
        streams[id] = controller
        return stream
      }

      for await (const { payload, header, kind, id } of generator) {
        if (kind === 0x02) {
          streams[id!].enqueue(payload)
        } else {
          const codec = getCodecFromHeader(header)

          switch (codec.type) {
            case 'structural':
              yield handleStructural({ payload, codec })
              break
            case 'generator':
              yield handleGenerator({ payload, codec })
              break
            case 'primitive':
              yield codec.decode(payload)
              break
            default:
              throw new Error('Unknown codec')
          }
        }
      }
    },
  }

  return api
}

// helper to concatenate Uint8Arrays
function concat(...arrays: Array<Uint8Array>): Uint8Array {
  const result = new Uint8Array(arrays.reduce((a, b) => a + b.length, 0))
  let index = 0
  return arrays.reduce((result, current) => {
    result.set(current, index)
    index += current.length
    return result
  }, result)
}
