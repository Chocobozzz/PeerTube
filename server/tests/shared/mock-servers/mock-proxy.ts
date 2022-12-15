import { createServer, Server } from 'http'
import proxy from 'proxy'
import { getPort, terminateServer } from './shared'

class MockProxy {
  private server: Server

  initialize () {
    return new Promise<number>(res => {
      this.server = proxy(createServer())
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
