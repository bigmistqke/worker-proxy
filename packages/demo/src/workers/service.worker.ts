// Type definitions for the service worker methods
// The actual implementation is in public/service-worker.js

export interface FetchMethods {
  getUser(id: number): {
    id: number
    name: string
    email: string
    createdAt: string
  }
  listUsers(): Array<{ id: number; name: string; email: string }>
  createUser(data: { name: string; email: string }): {
    id: number
    name: string
    email: string
    createdAt: string
  }
  api: {
    status(): { status: string; uptime: number }
    echo(message: string): { echo: string; timestamp: number }
  }
}

export interface StreamMethods {
  ping(): string
  time(): string
}
