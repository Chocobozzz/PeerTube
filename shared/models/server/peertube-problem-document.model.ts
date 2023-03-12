import { HttpStatusCode } from '../../models'
import { OAuth2ErrorCode, ServerErrorCode } from './server-error-code.enum'

export interface PeerTubeProblemDocumentData {
  'invalid-params'?: Record<string, object>

  originUrl?: string

  keyId?: string

  targetUrl?: string

  actorUrl?: string

  // Feeds
  format?: string
  url?: string
}

export interface PeerTubeProblemDocument extends PeerTubeProblemDocumentData {
  type: string
  title: string

  detail: string
  // Compat PeerTube <= 3.2
  error: string

  status: HttpStatusCode

  docs?: string
  code?: ServerErrorCode | OAuth2ErrorCode
}
