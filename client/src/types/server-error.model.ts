import { ServerErrorCodeType } from '@peertube/peertube-models'

export class PeerTubeServerError extends Error {
  serverCode: ServerErrorCodeType

  constructor (message: string, serverCode: ServerErrorCodeType) {
    super(message)
    this.name = 'CustomError'
    this.serverCode = serverCode
  }
}
