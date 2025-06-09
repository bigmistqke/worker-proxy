import {
  $MESSENGER_RESPONSE,
  RequestShape,
  ResponseShape,
  RPCPayloadShape,
} from '../message-protocol'
import { RPC } from '../types'
import { callMethod, createCommander, createPromiseRegistry, defer } from '../utils'

const $STREAM_REQUEST_HEADER = 'RPC_STREAM_REQUEST_HEADER'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const isStreamRequest = (event: { request: Request }) =>
  event.request.headers.has($STREAM_REQUEST_HEADER)

function send(controller: ReadableStreamDefaultController<any>, data: any) {
  controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
}

async function listen(
  stream: ReadableStream | Promise<ReadableStream>,
  callback: (payload: any) => void,
) {
  const reader = (await stream).getReader()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newlineIndex
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      const response = JSON.parse(line)
      callback(response)
    }
  }
}

function createReadableStream() {
  const closeHandlers = new Set<() => void>()
  let controller: ReadableStreamDefaultController = null!
  let closed = false

  const stream = new ReadableStream({
    start(_controller) {
      controller = _controller
    },
    cancel() {
      closeHandlers.forEach(handler => handler())
      closed = true
    },
  })

  return {
    controller,
    stream,
    closed() {
      return closed
    },
    onClose(cb: () => void) {
      closeHandlers.add(cb)
      return () => closeHandlers.delete(cb)
    },
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                       rpc                                      */
/*                                                                                */
/**********************************************************************************/

export function rpc<TProxy extends object, TExpose extends object = object>(
  reader:
    | ((stream: ReadableStream) => ReadableStream | Promise<ReadableStream>)
    | ReadableStream
    | Promise<ReadableStream>,
  methods: TExpose,
) {
  const promiseRegistry = createPromiseRegistry()
  const { stream, controller, closed, onClose } = createReadableStream()

  listen(typeof reader === 'function' ? reader(stream) : reader, async data => {
    if (methods && RequestShape.validate(data) && RPCPayloadShape.validate(data.payload)) {
      const {
        payload: { topics, args },
      } = data
      send(controller, ResponseShape.create(data, await callMethod(methods, topics, args)))
    } else if (ResponseShape.validate(data)) {
      promiseRegistry.free(data[$MESSENGER_RESPONSE])?.resolve(data.payload)
    }
  })

  return {
    proxy: createCommander<RPC<TProxy>>(async (topics, args) => {
      if (closed?.()) {
        throw new Error(`[rpc/sse] Stream is closed.`)
      }
      const { promise, resolve, reject } = defer()
      const id = promiseRegistry.register({ resolve, reject })
      send(controller, RequestShape.create(id, RPCPayloadShape.create(topics, args)))
      return promise
    }),
    closed,
    onClose,
    stream,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                Client / Server                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * Exposes a set of methods as an RPC endpoint over the given messenger.
 *
 * @param methods - An object containing functions to expose
 * @param options - Optional target Messenger and abort signal
 */
export function client<TProxy extends object, TExpose extends object = object>(
  url: string,
  methods: TExpose,
) {
  return rpc<TProxy, TExpose>(
    stream =>
      fetch(url, {
        method: 'POST',
        body: stream,
        // @ts-expect-error
        duplex: 'half',
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          [$STREAM_REQUEST_HEADER]: '1',
        },
      }).then(response => response.body!),
    methods,
  )
}

/**
 * Creates an RPC proxy for calling remote methods on the given Messenger.
 *
 * @param messenger - The Messenger to communicate with (e.g. Worker or Window)
 * @param options - Optional abort signal
 * @returns A proxy object that lets you call methods remotely
 */
export function server<TProxy extends object, TExpose extends object = object>(
  reader: ReadableStream,
  methods: TExpose,
) {
  const { proxy, closed, onClose, stream } = rpc<TProxy, TExpose>(reader, methods)
  return {
    proxy,
    closed,
    onClose,
    response: new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }),
  }
}
