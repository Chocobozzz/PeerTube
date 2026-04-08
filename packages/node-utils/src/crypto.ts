import { BinaryToTextEncoding, createHash } from 'crypto'

export function sha256 (str: string | Uint8Array, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha256').update(str).digest(encoding)
}

export function sha1 (str: string | Uint8Array, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha1').update(str).digest(encoding)
}

export function md5 (str: string | Uint8Array) {
  return createHash('md5').update(str).digest()
}
