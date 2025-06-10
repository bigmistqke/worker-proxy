const MAX_UINT_32 = Math.pow(2, 32) - 1
const encoder = new TextEncoder()
const decoder = new TextDecoder()

type Codec = StructuralCodec | PrimitiveCodec | GeneratorCodec

class CodecBase<
  TConfig extends {
    test(value: any): boolean
    encode(value: any): any
    decode(value: any): any
  },
> {
  test: TConfig['test']
  encode: TConfig['encode']
  decode: TConfig['decode']
  constructor({ test, encode, decode }: TConfig) {
    this.test = test
    this.encode = encode
    this.decode = decode
  }
}

export interface PrimitiveCodecMethods<T> {
  test: (value: any) => boolean
  encode: (value: T) => Uint8Array
  decode: (buffer: Uint8Array) => T
}
export class PrimitiveCodec<T = any> extends CodecBase<PrimitiveCodecMethods<T>> {
  type = 'primitive' as const
}

export interface StructuralCodecMethods<T> {
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
  decode: () => { value: T; set(value: any, key: string | number): void }
}

export class StructuralCodec<T = any> extends CodecBase<StructuralCodecMethods<T>> {
  type = 'structural' as const
}

export interface GeneratorCodecMethods<T> {
  test: (value: any) => boolean
  encode: (value: T) => AsyncGenerator<Uint8Array | undefined>
  decode: () => AsyncGenerator<T, unknown, Uint8Array>
}

export class GeneratorCodec<T = any> extends CodecBase<GeneratorCodecMethods<T>> {
  type = 'generator' as const
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
    if (encoded.length > MAX_UINT_32)
      throw new Error(`Tried to encode something larger than MAX_UINT_32`)
    buffer.set(encoded, DEFAULT_PREFIX)
    return buffer
  }

  const CHUNK_PREFIX = 1 + 1 + 4 + 4
  function packChunk(id: number, header: number, encoded?: Uint8Array): Uint8Array {
    const buffer = new Uint8Array(CHUNK_PREFIX + (encoded?.length ?? 0))
    buffer[0] = 0x02
    buffer[1] = header
    const view = new DataView(buffer.buffer)
    view.setUint32(6, id)
    if (encoded) {
      view.setUint32(2, encoded.length)
      if (encoded.length > MAX_UINT_32)
        throw new Error(`Tried to encode something larger than MAX_UINT_32`)
      buffer.set(encoded, CHUNK_PREFIX)
    }
    return buffer
  }

  const CHUNK_END_PREFIX = 1 + 1 + 4
  function packChunkEnd(id: number, header: number): Uint8Array {
    const buffer = new Uint8Array(CHUNK_END_PREFIX)
    buffer[0] = 0x03
    buffer[1] = header
    const view = new DataView(buffer.buffer)
    view.setUint32(2, id)
    return buffer
  }

  function unpack(buffer: Uint8Array) {
    const kind = buffer[0]!
    const header = buffer[1]!
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const length = kind === 0x03 ? 0 : view.getUint32(2)
    const prefix = kind === 0x01 ? DEFAULT_PREFIX : kind === 0x02 ? CHUNK_PREFIX : CHUNK_END_PREFIX
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
      case 0x03:
        return {
          kind,
          header,
          id: view.getUint32(2),
          rest,
          payload,
        }
      default:
        throw new Error(`Incorrect kind ${kind}`)
    }
  }

  async function* createChunkGenerator(stream: ReadableStream<Uint8Array>): AsyncGenerator<{
    kind: number
    header: number
    length: number
    payload: Uint8Array
    id?: number
  }> {
    const reader = stream.getReader()
    let buffer = new Uint8Array(new ArrayBuffer(0))

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
  const streams: Record<string, AsyncGenerator<unknown, unknown, Uint8Array>> = {}

  const api = {
    *serialize(value: any): Generator<Uint8Array | (() => AsyncGenerator<Uint8Array>)> {
      const { codec, header } = getCodecFromValue(value)
      const generators = new Array<{
        generator: AsyncGenerator<Uint8Array | undefined>
        id: number
        codec: GeneratorCodec
        header: number
      }>()

      switch (codec.type) {
        case 'structural':
          const { keys, values, length } = codec.encode(value)
          yield pack(header, JSONCodec.encode(length ?? keys))
          for (const value of values) {
            for (const chunk of api.serialize(value)) {
              yield chunk
            }
          }
          break
        case 'generator':
          const generator = codec.encode(value)
          const id = streamId++
          generators.push({ generator, codec, id, header })
          yield pack(header, JSONCodec.encode({ id }))
          break
        case 'primitive':
          yield pack(header, codec.encode(value))
          break
        default:
          throw new Error(`Unknown Codec`)
      }

      if (generators.length) {
        yield async function* () {
          for (const { generator, id, header } of generators) {
            for await (const value of generator) {
              yield packChunk(id, header, value)
            }
            yield packChunkEnd(id, header)
          }
        }
      }
    },
    async *deserialize(stream: ReadableStream) {
      const generator = createChunkGenerator(stream)

      for await (const { payload, header, kind, id } of generator) {
        switch (kind) {
          case 0x01:
            const codec = getCodecFromHeader(header)
            yield await handleCodec({ codec, payload })
            break
          case 0x02:
            streams[id!].next(payload)
            break
          case 0x03:
            await streams[id!].return(false)
            delete streams[id!]
            break
        }
      }

      function handleCodec({ codec, payload }: { codec: Codec; payload: Uint8Array }) {
        switch (codec.type) {
          case 'structural':
            return handleStructural({ payload, codec })
          case 'generator':
            return handleGenerator({ payload, codec })
          case 'primitive':
            return codec.decode(payload)
          default:
            throw new Error('Unknown codec')
        }
      }

      async function handleStructural({
        payload,
        codec,
      }: {
        payload: Uint8Array
        codec: StructuralCodec
      }) {
        const paths = JSONCodec.decode(payload) as Array<string> | number

        const { value, set } = codec.decode()

        const total = typeof paths === 'number' ? paths : paths.length

        for (let i = 0; i < total; i++) {
          const key = typeof paths === 'number' ? i : paths[i]!
          const { value, done } = await generator.next()
          if (done) break

          const { payload, header } = value
          const codec = getCodecFromHeader(header)
          set(await handleCodec({ codec, payload }), key)
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
        const generator = codec.decode()
        const { value } = await generator.next()
        streams[id] = generator
        return value
      }
    },
  }

  return api
}

// helper to concatenate Uint8Arrays
function concat(...arrays: Array<Uint8Array>): Uint8Array {
  const result = new Uint8Array(new ArrayBuffer(arrays.reduce((a, b) => a + b.length, 0)))
  let index = 0
  return arrays.reduce<Uint8Array>((result, current) => {
    result.set(current, index)
    index += current.length
    return result
  }, result)
}
