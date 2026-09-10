import { ParsedDraftSignature, parseRequestSignature, verifyDraftSignature } from '@misskey-dev/node-http-message-signatures'
import { generateRSAKeyPairPromise, sha256 } from '@peertube/peertube-node-utils'
import { timingSafeEqual } from 'crypto'
import { Request } from 'express'
import { BCRYPT_SALT_SIZE, PRIVATE_RSA_KEY_SIZE } from '../initializers/constants.js'
import { MActor } from '../types/models/index.js'
import { decrypt, encrypt } from './encryption.js'
import { createLogger } from './logger.js'

const logger = createLogger()

function createPrivateAndPublicKeys () {
  logger.info('Generating a RSA key...')

  return generateRSAKeyPairPromise(PRIVATE_RSA_KEY_SIZE)
}

// ---------------------------------------------------------------------------
// User password checks
// ---------------------------------------------------------------------------

async function comparePassword (plainPassword: string, hashPassword: string) {
  if (!plainPassword) return false

  if (Buffer.byteLength(plainPassword, 'utf8') > 72) {
    throw new Error('Cannot compare more than 72 bytes with bcrypt')
  }

  const { compare } = await import('bcrypt')

  return compare(plainPassword, hashPassword)
}

async function cryptPassword (password: string) {
  const { genSalt, hash } = await import('bcrypt')

  const salt = await genSalt(BCRYPT_SALT_SIZE)

  return hash(password, salt)
}

// ---------------------------------------------------------------------------
// Secret comparison
// ---------------------------------------------------------------------------

// Prevent timing attacks when comparing secret tokens (email verification, password reset etc.)
function isSecretEqual (a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string') return false

  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)

  if (aBuffer.length !== bBuffer.length) return false

  return timingSafeEqual(aBuffer, bBuffer)
}

// ---------------------------------------------------------------------------
// HTTP Signature
// ---------------------------------------------------------------------------

function isHTTPSignatureDigestValid (rawBody: Buffer, req: Request): boolean {
  if (req.headers['signature'] && req.headers['digest']) {
    return buildDigest(rawBody.toString()) === req.headers['digest']
  }

  return true
}

async function isHTTPSignatureVerified (httpSignatureParsed: ParsedDraftSignature, actor: MActor): Promise<boolean> {
  const result = await verifyDraftSignature(
    httpSignatureParsed.value,
    actor.publicKey,
    msg => logger.debug('Error in verify draft signature: ' + msg)
  )

  return result === true
}

function parseHTTPSignature (req: Request, clockSkewSeconds?: number): ParsedDraftSignature {
  const requiredHeaders = req.method === 'POST'
    ? [ '(request-target)', 'host', 'digest' ]
    : [ '(request-target)', 'host' ]

  const clockSkew = clockSkewSeconds
    ? clockSkewSeconds * 1000
    : undefined

  const parsed = parseRequestSignature(req, {
    requiredComponents: {
      draft: requiredHeaders
    },
    clockSkew: {
      delay: clockSkew
    }
  })

  if (parsed.version !== 'draft') {
    throw new Error(`Only draft version of HTTP signature is supported`)
  }

  const parsedHeaders = parsed.value.params.headers
  if (!parsedHeaders.includes('date') && !parsedHeaders.includes('(created)')) {
    throw new Error(`date or (created) must be included in signature`)
  }

  return parsed
}

// ---------------------------------------------------------------------------

function buildDigest (body: any) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body)

  return 'SHA-256=' + sha256(rawBody, 'base64')
}

// ---------------------------------------------------------------------------

export {
  buildDigest,
  comparePassword,
  createPrivateAndPublicKeys,
  cryptPassword,
  decrypt,
  encrypt,
  isHTTPSignatureDigestValid,
  isHTTPSignatureVerified,
  isSecretEqual,
  parseHTTPSignature
}
