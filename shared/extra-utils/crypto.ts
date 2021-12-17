import { BinaryToTextEncoding, createHash } from 'crypto'

function sha256 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha256').update(str).digest(encoding)
}

function sha1 (str: string | Buffer, encoding: BinaryToTextEncoding = 'hex') {
  return createHash('sha1').update(str).digest(encoding)
}

// high excluded
function randomInt (low: number, high: number) {
  return Math.floor(Math.random() * (high - low) + low)
}

export {
  randomInt,
  sha256,
  sha1
}
