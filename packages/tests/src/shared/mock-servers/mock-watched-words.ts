import express from 'express'
import { Server } from 'http'
import { getPort, randomListen, terminateServer } from './shared.js'

export class MockWatchedWords {
  private server: Server

  private name = 'Remote watched words'
  private actions: { type: 'add' | 'remove', word: string, createdAt: string }[] = []

  async initialize () {
    const app = express()

    app.get([ '/list.json', '/list-copy.json' ], (_req: express.Request, res: express.Response) => {
      return res.json({
        name: this.name,
        actions: this.actions
      })
    })

    app.get([ '/list-2', '/list-2-copy' ], (_req: express.Request, res: express.Response) => {
      return res.json({
        name: 'Another watched words list',
        actions: []
      })
    })

    app.get([ '/list-3', '/list-3-copy' ], (_req: express.Request, res: express.Response) => {
      return res.json({
        name: 'Another watched words list with actions',
        actions: [
          {
            type: 'add',
            word: 'unrelated-word',
            createdAt: new Date('2020-01-01T00:00:00.000Z').toISOString()
          }
        ]
      })
    })

    app.get('/invalid-watched-words-1', (_req: express.Request, res: express.Response) => {
      return res.json({ name: '', actions: [] })
    })

    app.get('/invalid-watched-words-2', (_req: express.Request, res: express.Response) => {
      return res.send('')
    })

    app.get('/too-many-watched-words', (_req: express.Request, res: express.Response) => {
      const actions = Array.from({ length: 501 }, (_, i) => ({
        type: 'add' as const,
        word: `word-${i}`,
        createdAt: new Date(`2020-01-01T00:00:${(i % 60).toString().padStart(2, '0')}.000Z`).toISOString()
      }))

      return res.json({
        name: 'Too many watched words',
        actions
      })
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  setName (name: string) {
    this.name = name
  }

  setActions (actions: { type: 'add' | 'remove', word: string, createdAt: string }[]) {
    this.actions = actions
  }

  terminate () {
    return terminateServer(this.server)
  }
}
