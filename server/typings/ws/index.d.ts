import { Server } from 'ws'

declare module 'ws' {
  // FIXME: remove when 'ws' is fixed
  export class WebSocketServer extends Server {

  }
}
