import * as express from 'express'
import { randomInt } from '@shared/core-utils'

export class MockInstancesIndex {
  private readonly indexInstances: { host: string, createdAt: string }[] = []

  initialize () {
    return new Promise<number>(res => {
      const app = express()

      app.use('/', (req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (process.env.DEBUG) console.log('Receiving request on mocked server %s.', req.url)

        return next()
      })

      app.get('/api/v1/instances/hosts', (req: express.Request, res: express.Response) => {
        const since = req.query.since

        const filtered = this.indexInstances.filter(i => {
          if (!since) return true

          return i.createdAt > since
        })

        return res.json({
          total: filtered.length,
          data: filtered
        })
      })

      const port = 42101 + randomInt(1, 100)
      app.listen(port, () => res(port))
    })
  }

  addInstance (host: string) {
    this.indexInstances.push({ host, createdAt: new Date().toISOString() })
  }
}
