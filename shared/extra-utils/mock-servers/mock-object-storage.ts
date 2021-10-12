import express from 'express'
import got, { RequestError } from 'got'
import { Server } from 'http'
import { pipeline } from 'stream'
import { randomInt } from '@shared/core-utils'
import { ObjectStorageCommand } from '../server'
import { terminateServer } from './utils'

export class MockObjectStorage {
  private server: Server

  initialize () {
    return new Promise<number>(res => {
      const app = express()

      app.get('/:bucketName/:path(*)', (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const url = `http://${req.params.bucketName}.${ObjectStorageCommand.getEndpointHost()}/${req.params.path}`

        if (process.env.DEBUG) {
          console.log('Receiving request on mocked server %s.', req.url)
          console.log('Proxifying request to %s', url)
        }

        return pipeline(
          got.stream(url, { throwHttpErrors: false }),
          res,
          (err: RequestError) => {
            if (!err) return

            console.error('Pipeline failed.', err)
          }
        )
      })

      const port = 44000 + randomInt(1, 1000)
      this.server = app.listen(port, () => res(port))
    })
  }

  terminate () {
    return terminateServer(this.server)
  }
}
