
import { createServer, Server } from 'http'
import * as proxy from 'proxy'
import { randomInt } from '@shared/core-utils'

class MockProxy {
  private server: Server

  initialize () {
    return new Promise<number>(res => {
      const port = 42501 + randomInt(1, 100)

      this.server = proxy(createServer())
      this.server.listen(port, () => res(port))
    })
  }

  terminate () {
    if (this.server) this.server.close()
  }
}

// ---------------------------------------------------------------------------

export {
  MockProxy
}
