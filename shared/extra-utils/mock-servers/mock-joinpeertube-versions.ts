import * as express from 'express'
import { randomInt } from '@shared/core-utils'

export class MockJoinPeerTubeVersions {
  private latestVersion: string

  initialize () {
    return new Promise<number>(res => {
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

      const port = 42201 + randomInt(1, 100)
      app.listen(port, () => res(port))
    })
  }

  setLatestVersion (latestVersion: string) {
    this.latestVersion = latestVersion
  }
}
