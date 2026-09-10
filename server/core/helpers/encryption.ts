import { CipherGCM, createCipheriv, createDecipheriv, DecipherGCM, Encoding } from 'crypto'
import { randomBytesPromise, scryptPromise } from '@peertube/peertube-node-utils'

/**
 * AES-256-GCM helpers, re-exported by `peertube-crypto.ts` for the rest of the application.
 *
 * They live in their own module because the bootstrap of a secondary process decrypts the configuration
 * published by its primary while `CONFIG` is still being built: nothing here may import
 * `initializers/constants.js`, which reads `CONFIG` as soon as it is loaded, hence the local `ENCRYPTION`.
 *
 * Format: salt:iv:authTag:ciphertext in hex format
 * AES-256-GCM authenticates the ciphertext, so decrypt() returns exactly the bytes that were encrypted or throws
 */
export const ENCRYPTION = {
  ALGORITHM: 'aes-256-gcm',
  IV: 12, // 96-bit IV, the NIST-recommended size for GCM
  SALT: 16, // random salt length
  AUTH_TAG: 16,
  KEY_LENGTH: 32,
  ENCODING: 'hex' as Encoding
}

export async function encrypt (str: string, secret: string) {
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

export async function decrypt (encryptedArg: string, secret: string) {
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
