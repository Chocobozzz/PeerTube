import { exists } from './misc.js'

export function isValidCreateTranscodingType (value: any) {
  return exists(value) && (value === 'hls' || value === 'web-video')
}
