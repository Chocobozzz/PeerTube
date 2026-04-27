import express from 'express'
import { Server } from 'http'
import { getPort, randomListen, terminateServer } from './shared.js'

export class MockCoreBlocklist {
  private server: Server

  private actions: { type: 'block' | 'unblock', target: string, createdAt: string }[] = []

  async initialize () {
    const app = express()

    app.get('/list.json', (req: express.Request, res: express.Response) => {
      return res.json({
        name: 'Test subscription',
        actions: this.actions
      })
    })

    app.get('/list-2', (req: express.Request, res: express.Response) => {
      return res.json({
        name: 'another subscription list',
        actions: []
      })
    })

    app.get('/invalid-blocklist-1', (req: express.Request, res: express.Response) => {
      return res.json({ actions: [], name: '' })
    })

    app.get('/invalid-blocklist-2', (req: express.Request, res: express.Response) => {
      return res.send('')
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  setActions (actions: { type: 'block' | 'unblock', target: string, createdAt: string }[]) {
    this.actions = actions
  }

  terminate () {
    return terminateServer(this.server)
  }
}
