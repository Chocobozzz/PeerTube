import express from 'express'
import { Server } from 'http'
import { getPort, randomListen, terminateServer } from './shared.js'

export class MockHTTP {
  private server: Server

  async initialize () {
    const app = express()

    app.get('/redirect/*', (req: express.Request, res: express.Response, next: express.NextFunction) => {

      return res.redirect(req.params[0])
    })

    app.get('/*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      return res.sendStatus(200)
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  terminate () {
    return terminateServer(this.server)
  }
}
