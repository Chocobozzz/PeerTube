import { ServerErrorCode } from '@shared/models/index'

export class PeerTubeServerError extends Error {
  serverCode: ServerErrorCode

  constructor (message: string, serverCode: ServerErrorCode) {
    super(message)
    this.name = 'CustomError'
    this.serverCode = serverCode
  }
}
