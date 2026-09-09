import { HttpStatusCode } from '@peertube/peertube-models'
import { LoggerLevel } from './logger.js'
import { PeerTubeRequestError } from './requests.js'

// Remote object is gone, private or behind authorized fetch: nothing we can do about it
const expectedStatusCodes = new Set<number>([
  HttpStatusCode.UNAUTHORIZED_401,
  HttpStatusCode.FORBIDDEN_403,
  HttpStatusCode.NOT_FOUND_404,
  HttpStatusCode.GONE_410
])

// The remote instance is unreachable or has a broken TLS setup
const expectedErrorCodes = new Set<string>([
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'EPROTO',
  'ETIMEDOUT',

  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
])

const expectedErrorNames = new Set<string>([
  // got
  'TimeoutError',
  // Remote sent a payload our JSON-LD safe mode rejects (relative @id, unmapped term...)
  'jsonld.ValidationError'
])

// ---------------------------------------------------------------------------

// An error caused by the remote instance and not by us
// Expected on any federated instance, so it should not be logged as a warning/error the admin has to act on
export function isExpectedRemoteError (err: any) {
  if (!err) return false

  const { statusCode, code, name } = err as PeerTubeRequestError

  if (expectedStatusCodes.has(statusCode)) return true
  if (expectedErrorCodes.has(code)) return true
  if (expectedErrorNames.has(name)) return true

  return false
}

export function getRemoteErrorLogLevel (err: any, fallback: LoggerLevel = 'warn'): LoggerLevel {
  return isExpectedRemoteError(err)
    ? 'info'
    : fallback
}
