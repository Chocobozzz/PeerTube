import * as express from 'express'
import { Server } from 'http'
import { randomInt } from '@shared/core-utils'

type BlocklistResponse = {
  data: {
    value: string
    action?: 'add' | 'remove'
    updatedAt?: string
  }[]
}

export class MockBlocklist {
  private body: BlocklistResponse
  private server: Server

  initialize () {
    return new Promise<number>(res => {
      const app = express()

      app.get('/blocklist', (req: express.Request, res: express.Response) => {
        return res.json(this.body)
      })

      const port = 42201 + randomInt(1, 100)
      this.server = app.listen(port, () => res(port))
    })
  }

  replace (body: BlocklistResponse) {
    this.body = body
  }

  terminate () {
    if (this.server) this.server.close()
  }
}
