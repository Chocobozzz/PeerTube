
import { createServer, Server } from 'http'
import proxy from 'proxy'
import { randomInt } from '@shared/core-utils'
import { terminateServer } from './utils'

class MockProxy {
  private server: Server

  initialize () {
    return new Promise<number>(res => {
      const port = 46000 + randomInt(1, 1000)

      this.server = proxy(createServer())
      this.server.listen(port, () => res(port))
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
