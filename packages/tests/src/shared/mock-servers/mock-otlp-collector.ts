import express from 'express'
import { Server } from 'http'
import { getPort, randomListen, terminateServer } from './shared.js'

// Receive traces sent by the OTLP HTTP (JSON) exporter
export class MockOTLPCollector {
  private server: Server

  private readonly spanNames: string[] = []

  async initialize () {
    const app = express()

    app.post('/v1/traces', express.json({ limit: '10mb' }), (req: express.Request, res: express.Response) => {
      for (const resourceSpans of req.body.resourceSpans ?? []) {
        for (const scopeSpans of resourceSpans.scopeSpans ?? []) {
          for (const span of scopeSpans.spans ?? []) {
            this.spanNames.push(span.name)
          }
        }
      }

      return res.json({})
    })

    this.server = await randomListen(app)

    return getPort(this.server)
  }

  getSpanNames () {
    return this.spanNames
  }

  terminate () {
    return terminateServer(this.server)
  }
}
