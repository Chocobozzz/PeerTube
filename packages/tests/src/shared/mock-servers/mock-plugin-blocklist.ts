import express, { Request, Response } from 'express'
import { Server } from 'http'
import { getPort, randomListen, terminateServer } from './shared.js'

type BlocklistResponse = {
  data: {
    value: string
    action?: 'add' | 'remove'
    updatedAt?: string
  }[]
}

export class MockBlocklist {
  private body: BlocklistResponse
  private server: Server

  async initialize () {
    const app = express()

    app.get('/blocklist', (req: Request, res: Response) => {
      return res.json(this.body)
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  replace (body: BlocklistResponse) {
    this.body = body
  }

  terminate () {
    return terminateServer(this.server)
  }
}
