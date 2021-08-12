import * as express from 'express'
import got, { RequestError } from 'got'
import { Server } from 'http'
import { pipeline } from 'stream'
import { randomInt } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import { makePostBodyRequest } from '../requests'

export class MockObjectStorage {
  private server: Server

  initialize () {
    return new Promise<number>(res => {
      const app = express()

      app.get('/:bucketName/:path(*)', (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const url = `http://${req.params.bucketName}.${this.getEndpointHost()}/${req.params.path}`

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

      const port = 42301 + randomInt(1, 100)
      this.server = app.listen(port, () => res(port))
    })
  }

  getCrendentialsConfig () {
    return {
      access_key_id: 'AKIAIOSFODNN7EXAMPLE',
      secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    }
  }

  getEndpointHost () {
    return 'localhost:9444'
  }

  getRegion () {
    return 'us-east-1'
  }

  async createBucket (name: string) {
    await makePostBodyRequest({
      url: this.getEndpointHost(),
      path: '/ui/' + name + '?delete',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })

    await makePostBodyRequest({
      url: this.getEndpointHost(),
      path: '/ui/' + name + '?create',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })

    await makePostBodyRequest({
      url: this.getEndpointHost(),
      path: '/ui/' + name + '?make-public',
      expectedStatus: HttpStatusCode.TEMPORARY_REDIRECT_307
    })
  }

  terminate () {
    if (this.server) this.server.close()
  }
}
