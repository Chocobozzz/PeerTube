import { OAuth2ErrorCodeType, ServerErrorCodeType } from '../server/server-error-code.enum.js'

export type InternalErrorCodeType = 'INVALID_IMAGE_FILE'

type ErrorCode = ServerErrorCodeType | OAuth2ErrorCodeType | InternalErrorCodeType

export class PeerTubeError extends Error {
  code: ErrorCode
  isPeerTubeError = true

  constructor (message: string, code: ErrorCode, cause?: Error) {
    super(message, { cause })

    this.code = code
  }

  static fromError (error: Error, code: ErrorCode) {
    return new PeerTubeError(error.message, code, error)
  }
}

export function isPeerTubeError (error: any): error is PeerTubeError {
  if (!error) return false

  return error instanceof PeerTubeError || error.isPeerTubeError === true
}
