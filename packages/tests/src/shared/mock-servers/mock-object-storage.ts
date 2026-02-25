import express from 'express'
import got, { RequestError } from 'got'
import { Server } from 'http'
import { pipeline } from 'stream'
import { ObjectStorageCommand } from '@peertube/peertube-server-commands'
import { getPort, randomListen, terminateServer } from './shared.js'

export class MockObjectStorageProxy {
  private server: Server

  async initialize () {
    const app = express()

    app.get('/:bucketName/:path(*)', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const bucketName = req.params.bucketName

      let path = req.params.path
      // Some tests use `/:bucketName/:bucketName/:path` structure
      path = path.replace(new RegExp(`^${bucketName}/`), '')

      const url = `http://${bucketName}.${ObjectStorageCommand.getMockEndpointHost()}/${path}`

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

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  terminate () {
    return terminateServer(this.server)
  }
}
