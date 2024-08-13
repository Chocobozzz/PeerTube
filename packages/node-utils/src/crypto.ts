import { BinaryToTextEncoding, createHash } from 'crypto'

export function sha256 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha256').update(str).digest(encoding)
}

export function sha1 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha1').update(str).digest(encoding)
}
