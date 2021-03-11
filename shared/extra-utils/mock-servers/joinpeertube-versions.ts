import * as express from 'express'

export class MockJoinPeerTubeVersions {
  private latestVersion: string

  initialize () {
    return new Promise<void>(res => {
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

      app.listen(42102, () => res())
    })
  }

  setLatestVersion (latestVersion: string) {
    this.latestVersion = latestVersion
  }
}
