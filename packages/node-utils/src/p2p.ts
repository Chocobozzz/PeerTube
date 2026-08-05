import { sha1 } from './crypto.js'

export function generateP2PMediaLoaderHash (input: string) {
  // Create a string of 15 bytes, converted to base64 and then to ascii to have 20 characters
  // See https://github.com/Novage/p2p-media-loader/issues/427
  return btoa(sha1(input, 'binary').slice(0, 15))
}
