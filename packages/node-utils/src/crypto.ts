import { promisify1, promisify3 } from '@peertube/peertube-core-utils'
import { BinaryToTextEncoding, createHash, ED25519KeyPairOptions, generateKeyPair, randomBytes, RSAKeyPairOptions, scrypt } from 'crypto'

export function sha256 (str: string | Uint8Array, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha256').update(str).digest(encoding)
}

export function sha1 (str: string | Uint8Array, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha1').update(str).digest(encoding)
}

export function md5 (str: string | Uint8Array) {
  return createHash('md5').update(str).digest()
}

// ---------------------------------------------------------------------------

export function generateRSAKeyPairPromise (size: number) {
  return new Promise<{ publicKey: string, privateKey: string }>((res, rej) => {
    const options: RSAKeyPairOptions<'pem', 'pem'> = {
      modulusLength: size,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }

    generateKeyPair('rsa', options, (err, publicKey, privateKey) => {
      if (err) return rej(err)

      return res({ publicKey, privateKey })
    })
  })
}

export function generateED25519KeyPairPromise () {
  return new Promise<{ publicKey: string, privateKey: string }>((res, rej) => {
    const options: ED25519KeyPairOptions<'pem', 'pem'> = {
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }

    generateKeyPair('ed25519', options, (err, publicKey, privateKey) => {
      if (err) return rej(err)

      return res({ publicKey, privateKey })
    })
  })
}

// ---------------------------------------------------------------------------

export const randomBytesPromise = promisify1<number, Buffer>(randomBytes)
export const scryptPromise = promisify3<string, string, number, Buffer>(scrypt)
