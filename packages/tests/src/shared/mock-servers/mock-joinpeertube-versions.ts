import express from 'express'
import { Server } from 'http'
import { getPort, randomListen } from './shared.js'

export class MockJoinPeerTubeVersions {
  private server: Server
  private latestVersion: string

  async initialize () {
    const app = express()

    app.use('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (process.env.DEBUG) console.log('Receiving request on mocked server %s.', req.url)

      return next()
    })

    app.get('/versions.json', (req: express.Request, res: express.Response) => {
      return res.json({
        peertube: {
          latestVersion: this.latestVersion
        }
      })
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  setLatestVersion (latestVersion: string) {
    this.latestVersion = latestVersion
  }
}
