import { BinaryToTextEncoding, createHash } from 'crypto'

function sha256 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha256').update(str).digest(encoding)
}

function sha1 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha1').update(str).digest(encoding)
}

export {
  sha256,
  sha1
}
