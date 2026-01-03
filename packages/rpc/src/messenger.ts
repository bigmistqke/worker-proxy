import {
  $MESSENGER_ERROR,
  $MESSENGER_RESPONSE,
  ErrorShape,
  RequestData,
  RequestShape,
  ResponseShape,
  RPCPayloadShape,
} from './message-protocol'
import { RPC } from './types'
import { callMethod, createCommander, createIdRegistry, defer } from './utils'

export const $TRANSFER = 'WORKER-TRANSFER'

interface WorkerMessenger {
  postMessage(message: any, transferables?: any[]): void
  addEventListener(key: 'message', callback: (event: MessageEvent) => void): void
  start?(): void
}

type Messenger = Window | WorkerMessenger

/**********************************************************************************/
/*                                                                                */
/*                                      Utils                                     */
/*                                                                                */
/**********************************************************************************/

/**
 * Checks whether the given target is a `Window` object (WindowProxy).
 */
function isWindowProxy(target: any): target is Window {
  return (
    typeof target === 'object' &&
    typeof target?.postMessage === 'function' &&
    typeof target?.closed === 'boolean'
  )
}

/**
 * Returns a `postMessage` function compatible with both Window and Worker contexts.
 */
function usePostMessage(messenger: Messenger) {
  if (isWindowProxy(messenger)) {
    return (message: any, transferables?: any[]) =>
      messenger.postMessage(message, '*', transferables)
  } else {
    return (message: any, transferables?: any[]) => messenger.postMessage(message, transferables)
  }
}

/**********************************************************************************/
/*                                                                                */
/*                              Requester / Responder                             */
/*                                                                                */
/**********************************************************************************/

/**
 * Sets up a requester that sends messages and returns promises resolving when a response is received.
 *
 * @param messenger - The target Messenger to send messages to
 * @param options - Optional abort signal
 * @returns A function to send payloads and await responses
 */
function createRequester(messenger: Messenger, options: { signal?: AbortSignal } = {}) {
  const promiseRegistry = createIdRegistry<{
    resolve(value: any): void
    reject(value: unknown): void
  }>()
  const postMessage = usePostMessage(messenger)

  messenger.addEventListener(
    'message',
    event => {
      const data = (event as MessageEvent<unknown>).data
      if (ErrorShape.validate(data)) {
        promiseRegistry.free(data[$MESSENGER_ERROR])?.reject(data.error)
      } else if (ResponseShape.validate(data)) {
        promiseRegistry.free(data[$MESSENGER_RESPONSE])?.resolve(data.payload)
      }
    },
    options,
  )

  if ('start' in messenger) {
    messenger.start?.()
  }

  return (payload: any, transferables?: any[]) => {
    const { promise, resolve, reject } = defer()
    const id = promiseRegistry.register({ resolve, reject })
    postMessage(RequestShape.create(id, payload), transferables)
    return promise
  }
}

/**
 * Sets up a responder that listens for requests and responds with the result of the callback.
 *
 * @param messenger - The Messenger to receive messages from
 * @param callback - A function called with the validated request event
 * @param options - Optional abort signal
 */
export function createResponder(
  messenger: Messenger,
  callback: (data: RequestData) => any,
  options: { signal?: AbortSignal } = {},
) {
  const postMessage = usePostMessage(messenger)

  messenger.addEventListener(
    'message',
    async event => {
      const data = (event as MessageEvent).data
      if (RequestShape.validate(data)) {
        try {
          const result = await callback(data)
          postMessage(ResponseShape.create(data, result))
        } catch (error) {
          postMessage(ErrorShape.create(data, error))
        }
      }
    },
    options,
  )

  if ('start' in messenger) {
    messenger.start?.()
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  Expose / Rpc                                  */
/*                                                                                */
/**********************************************************************************/

/**
 * Exposes a set of methods as an RPC endpoint over the given messenger.
 *
 * @param methods - An object containing functions to expose
 * @param options - Optional target Messenger and abort signal
 */
export function expose<T extends object>(
  methods: T,
  { to = self, signal }: { to?: Messenger; signal?: AbortSignal } = {},
) {
  createResponder(
    to,
    data => {
      if (RPCPayloadShape.validate(data.payload)) {
        try {
          const { topics, args } = data.payload
          return callMethod(methods, topics, args)
        } catch (error) {
          console.error('Error while processing rpc request:', error, data.payload, methods)
        }
      }
    },
    { signal },
  )
}

/**
 * Creates an RPC proxy for calling remote methods on the given Messenger.
 *
 * @param messenger - The Messenger to communicate with (e.g. Worker or Window)
 * @param options - Optional abort signal
 * @returns A proxy object that lets you call methods remotely
 */
export function rpc<T extends object>(
  messenger: Messenger,
  options?: { signal?: AbortSignal },
): RPC<T> {
  const request = createRequester(messenger, options)
  return createCommander<RPC<T>>((topics, args) => request(RPCPayloadShape.create(topics, args)))
}
