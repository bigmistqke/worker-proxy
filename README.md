# @bigmistqke/rpc

Type-safe RPC toolkit for communication across Workers, iframes, and network boundaries.

## Installation

```bash
npm install @bigmistqke/rpc
```

## Features

- **Type-safe**: Full TypeScript support with inferred types
- **Multiple transports**: Works with Web Workers, iframes, fetch, and streams
- **Nested methods**: Support for deeply nested method calls
- **Lightweight**: Minimal dependencies

## Modules

### `@bigmistqke/rpc/messenger`

Request-response RPC over `postMessage` for Workers and iframes.

**Worker:**

```ts
import { expose } from '@bigmistqke/rpc/messenger'

const methods = {
  greet: (name: string) => `Hello, ${name}!`,
  add: (a: number, b: number) => a + b,
  math: {
    square: (n: number) => n * n,
    factorial: (n: number): number => (n <= 1 ? 1 : n * methods.math.factorial(n - 1)),
  },
}

expose(methods)

export type Methods = typeof methods
```

**Main thread:**

```ts
import { rpc } from '@bigmistqke/rpc/messenger'
import type { Methods } from './worker'

const worker = new Worker('./worker.ts', { type: 'module' })
const proxy = rpc<Methods>(worker)

await proxy.greet('World') // "Hello, World!"
await proxy.add(2, 3) // 5
await proxy.math.square(4) // 16
```

### `@bigmistqke/rpc/fetch`

RPC over HTTP fetch requests.

**Server (e.g., Cloudflare Worker):**

```ts
import { expose, isFetchRequest } from '@bigmistqke/rpc/fetch'

const methods = {
  hello: () => 'Hello from server!',
  echo: (msg: string) => msg,
}

export default {
  async fetch(request: Request) {
    if (isFetchRequest({ request })) {
      return expose(methods)({ request })
    }
    return new Response('Not found', { status: 404 })
  },
}

export type Methods = typeof methods
```

**Client:**

```ts
import { rpc } from '@bigmistqke/rpc/fetch'
import type { Methods } from './server'

const proxy = rpc<Methods>('https://api.example.com')

await proxy.hello() // "Hello from server!"
await proxy.echo('test') // "test"
```

### `@bigmistqke/rpc/stream`

Bidirectional RPC over streams for persistent connections.

**Server:**

```ts
import { server, isStreamRequest } from '@bigmistqke/rpc/stream'

const serverMethods = {
  ping: () => 'pong',
}

export default {
  async fetch(request: Request) {
    if (isStreamRequest({ request })) {
      const { proxy, response } = server<ClientMethods, typeof serverMethods>(
        request.body!,
        serverMethods,
      )

      // Call client methods
      await proxy.clientMethod()

      return response
    }
  },
}
```

**Client:**

```ts
import { client } from '@bigmistqke/rpc/stream'

const clientMethods = {
  clientMethod: () => 'called from server',
}

const { proxy } = client<ServerMethods, typeof clientMethods>(
  'https://api.example.com',
  clientMethods,
)

await proxy.ping() // "pong"
```

## Demo

Check out the [live demo](https://bigmistqke.github.io/rpc/) to see all modules in action.

## License

MIT
