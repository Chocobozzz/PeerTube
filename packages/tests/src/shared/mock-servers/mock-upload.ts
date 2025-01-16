import { HttpStatusCode } from '@peertube/peertube-models'
import express from 'express'
import { Server } from 'http'
import multer from 'multer'
import { getPort, randomListen, terminateServer } from './shared.js'

export class MockUpload {
  private server: Server

  private uploads: { method: string, file: Buffer }[] = []

  async initialize () {
    const app = express()

    app.all(
      '/upload-file',
      multer({ storage: multer.memoryStorage() }).single('file'),
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (process.env.DEBUG) console.log('Receiving request on upload mock server.', req.url)

        this.uploads.push({ method: req.method, file: req.file.buffer })

        return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
      })

    app.get('/uploaded-files', (req: express.Request, res: express.Response) => {
      return res.json(this.uploads)
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  cleanUpload () {
    this.uploads = []
  }

  terminate () {
    return terminateServer(this.server)
  }
}
