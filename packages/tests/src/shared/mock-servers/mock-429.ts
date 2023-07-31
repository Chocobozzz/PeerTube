import express from 'express'
import { Server } from 'http'
import { getPort, randomListen, terminateServer } from './shared.js'

export class Mock429 {
  private server: Server
  private responseSent = false

  async initialize () {
    const app = express()

    app.get('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {

      if (!this.responseSent) {
        this.responseSent = true

        // Retry after 5 seconds
        res.header('retry-after', '2')
        return res.sendStatus(429)
      }

      return res.sendStatus(200)
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  terminate () {
    return terminateServer(this.server)
  }
}
