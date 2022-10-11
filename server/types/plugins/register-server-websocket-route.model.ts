import { IncomingMessage } from 'http'
import { Duplex } from 'stream'

export type RegisterServerWebSocketRouteOptions = {
  route: string

  handler: (request: IncomingMessage, socket: Duplex, head: Buffer) => any
}
