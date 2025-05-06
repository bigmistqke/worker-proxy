import {
  any,
  array,
  BaseSchema,
  boolean,
  InferOutput,
  number,
  object,
  safeParse,
  string,
  unknown,
} from 'valibot'
import { WorkerProxy } from './types'
import { createCommander, createIdRegistry, defer } from './utils'

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

/**
 * Creates a schema-backed shape definition with a validator and constructor.
 *
 * @param schema - A Valibot schema for the shape
 * @param create - A function that produces valid output for the schema
 */
function createShape<
  TSchema extends BaseSchema<any, any, any>,
  TCreate extends (...args: Array<any>) => InferOutput<TSchema>,
>(schema: TSchema, create: TCreate) {
  return {
    validate: (value: any): value is InferOutput<TSchema> => safeParse(schema, value).success,
    create,
  }
}

/**
 * Creates a message protocol that can validate incoming events and construct outgoing messages.
 *
 * @param schema - A Valibot schema describing the expected message data
 * @param createMessage - A function to construct valid message payloads
 */
function createMessageProtocol<
  TSchema extends BaseSchema<any, any, any>,
  TCreate extends (...args: Array<any>) => InferOutput<TSchema>,
>(schema: TSchema, createMessage: TCreate) {
  return {
    validateEvent: (value: Event): value is MessageEvent<InferOutput<TSchema>> =>
      safeParse(object({ data: schema }), value).success,
    createMessage,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                    Protocol                                    */
/*                                                                                */
/**********************************************************************************/

// Schema and protocol for requests
const $REQUEST = 'RPC_PROXY_REQUEST'

const requestSchema = object({
  [$REQUEST]: number(),
  payload: unknown(),
})

const RequestProtocol = createMessageProtocol(requestSchema, <T>(id: number, payload: T) => ({
  [$REQUEST]: id,
  payload,
}))

type RequestEvent = MessageEvent<InferOutput<typeof requestSchema>>

// Schema and protocol for responses
const $RESPONSE = 'RPC_PROXY_RESPONSE'

const ResponseProtocol = createMessageProtocol(
  object({
    [$RESPONSE]: number(),
    payload: unknown(),
  }),
  (event: RequestEvent, payload: any) => ({
    [$RESPONSE]: event.data[$REQUEST],
    payload,
  }),
)

// Schema and protocol of errors
const $ERROR = 'RPC_PROXY_ERROR'

const ErrorProtocol = createMessageProtocol(
  object({
    [$ERROR]: number(),
    error: unknown(),
  }),
  (event: RequestEvent, error: any) => ({
    [$ERROR]: event.data[$REQUEST],
    error,
  }),
)

// RPC-specific request payload
const $RPC_REQUEST = 'RPC_PROXY_RPC_REQUEST'

const RPCRequestPayload = createShape(
  object({
    [$RPC_REQUEST]: boolean(),
    topics: array(string()),
    args: array(any()),
  }),
  (topics: Array<string>, args: Array<any>) => ({ [$RPC_REQUEST]: true, topics, args }),
)

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
      if (ErrorProtocol.validateEvent(event)) {
        promiseRegistry.free(event.data[$ERROR])?.reject(event.data.error)
      } else if (ResponseProtocol.validateEvent(event)) {
        promiseRegistry.free(event.data[$RESPONSE])?.resolve(event.data.payload)
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
    postMessage(RequestProtocol.createMessage(id, payload), transferables)
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
function createResponder(
  messenger: Messenger,
  callback: (event: RequestEvent) => any,
  options: { signal?: AbortSignal } = {},
) {
  const postMessage = usePostMessage(messenger)

  messenger.addEventListener(
    'message',
    event => {
      if (RequestProtocol.validateEvent(event)) {
        try {
          postMessage(ResponseProtocol.createMessage(event, callback(event)))
        } catch (error) {
          postMessage(ErrorProtocol.createMessage(event, error))
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
    event => {
      if (RequestProtocol.validateEvent(event) && RPCRequestPayload.validate(event.data.payload)) {
        try {
          const method = event.data.payload.topics.reduce(
            (acc, topic) => (acc as any)[topic]!,
            methods as ((...args: Array<any>) => any) | object,
          )
          if (typeof method !== 'function') {
            throw `Topics is not a method`
          }
          return method(...event.data.payload.args)
        } catch (error) {
          console.error('Error while processing rpc request:', error, event.data.payload, methods)
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
): WorkerProxy<T> {
  const request = createRequester(messenger, options)
  return createCommander<WorkerProxy<T>>((topics, args) =>
    request(RPCRequestPayload.create(topics, args)),
  )
}
