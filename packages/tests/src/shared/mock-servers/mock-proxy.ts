import { createServer, Server } from 'http'
import { createProxy } from 'proxy'
import { getPort, terminateServer } from './shared.js'

class MockProxy {
  private server: Server

  initialize () {
    return new Promise<number>(res => {
      this.server = createProxy(createServer())
      this.server.listen(0, () => res(getPort(this.server)))
    })
  }

  terminate () {
    return terminateServer(this.server)
  }
}

// ---------------------------------------------------------------------------

export {
  MockProxy
}
