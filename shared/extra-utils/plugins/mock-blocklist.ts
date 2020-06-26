import * as express from 'express'
import { Server } from 'http'

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
    return new Promise(res => {
      const app = express()

      app.get('/blocklist', (req: express.Request, res: express.Response) => {
        return res.json(this.body)
      })

      this.server = app.listen(42100, () => res())
    })
  }

  replace (body: BlocklistResponse) {
    this.body = body
  }

  terminate () {
    if (this.server) this.server.close()
  }
}
