import express from 'express'
import { Server } from 'http'
import { getPort, randomListen, terminateServer } from './shared.js'

// Serve arbitrary content with an arbitrary content type, to simulate a remote host
export class MockFiles {
  private server: Server

  private readonly files = new Map<string, { contentType: string, body: string | Uint8Array }>()

  async initialize () {
    const app = express()

    app.use((req: express.Request, res: express.Response) => {
      const file = this.files.get(req.path)
      if (!file) return res.sendStatus(404)

      res.status(200)
      res.setHeader('Content-Type', file.contentType)

      return res.end(file.body)
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  setFile (path: string, contentType: string, body: string | Uint8Array) {
    this.files.set(path, { contentType, body })
  }

  terminate () {
    return terminateServer(this.server)
  }
}
