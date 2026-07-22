import { ParsedDraftSignature, parseRequestSignature, verifyDraftSignature } from '@misskey-dev/node-http-message-signatures'
import { sha256 } from '@peertube/peertube-node-utils'
import { CipherGCM, createCipheriv, createDecipheriv, DecipherGCM, timingSafeEqual } from 'crypto'
import { Request } from 'express'
import { BCRYPT_SALT_SIZE, ENCRYPTION, PRIVATE_RSA_KEY_SIZE } from '../initializers/constants.js'
import { MActor } from '../types/models/index.js'
import { generateRSAKeyPairPromise, randomBytesPromise, scryptPromise } from './core-utils.js'
import { logger } from './logger.js'

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
// Encryption
// ---------------------------------------------------------------------------

// Format: salt:iv:authTag:ciphertext in hex format
// AES-256-GCM authenticates the ciphertext, so decrypt() returns exactly the bytes that were encrypted or throws
async function encrypt (str: string, secret: string) {
  const salt = await randomBytesPromise(ENCRYPTION.SALT)
  const iv = await randomBytesPromise(ENCRYPTION.IV)

  const key = await scryptPromise(secret, salt.toString(ENCRYPTION.ENCODING), ENCRYPTION.KEY_LENGTH)
  const cipher = createCipheriv(ENCRYPTION.ALGORITHM, key, iv) as CipherGCM

  let cipherText = cipher.update(str, 'utf8', ENCRYPTION.ENCODING)
  cipherText += cipher.final(ENCRYPTION.ENCODING)

  // The auth tag is only available after final()
  const authTag = cipher.getAuthTag()

  return [
    salt.toString(ENCRYPTION.ENCODING),
    iv.toString(ENCRYPTION.ENCODING),
    authTag.toString(ENCRYPTION.ENCODING),
    cipherText
  ].join(':')
}

async function decrypt (encryptedArg: string, secret: string) {
  const parts = encryptedArg.split(':')

  // Pre-GCM values (2-part CBC) are re-encrypted at boot by the 1090-otp-secret-gcm migration,
  // so decrypt() only ever sees the GCM format at runtime
  if (parts.length !== 4) {
    throw new Error(`Unrecognized encrypted value format (${parts.length} parts)`)
  }

  const [ saltStr, ivStr, authTagStr, cipherText ] = parts

  // Pin the auth tag to its expected length
  const authTag = Buffer.from(authTagStr, ENCRYPTION.ENCODING)
  if (authTag.length !== ENCRYPTION.AUTH_TAG) {
    throw new Error(`Invalid auth tag length (${authTag.length} bytes)`)
  }

  const key = await scryptPromise(secret, saltStr, ENCRYPTION.KEY_LENGTH)

  const decipher = createDecipheriv(ENCRYPTION.ALGORITHM, key, Buffer.from(ivStr, ENCRYPTION.ENCODING)) as DecipherGCM
  decipher.setAuthTag(authTag)

  // final() throws if the auth tag does not match
  return decipher.update(cipherText, ENCRYPTION.ENCODING, 'utf8') + decipher.final('utf8')
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
