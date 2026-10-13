import { EncoderOptions } from '@peertube/peertube-models'

export type StreamType = 'audio' | 'video'

export function buildStreamSuffix (base: string, streamNum?: number) {
  if (streamNum !== undefined) {
    return `${base}:${streamNum}`
  }

  return base
}

export function getScaleFilter (options: EncoderOptions): string {
  if (options.scaleFilter) return options.scaleFilter.name

  return 'scale'
}

// ---------------------------------------------------------------------------

// Demuxers of the video and audio formats PeerTube accepts
// None of them opens the URLs a file may reference
const REMOTE_INPUT_FORMAT_WHITELIST = [
  'mov', // mov,mp4,m4a,3gp,3g2,mj2
  'matroska', // matroska,webm
  'ogg',
  'asf',
  'avi',
  'flv',
  'nut',
  'mxf',
  'mpegts',
  'mpeg',
  'mpegvideo',
  'm4v',
  'h264',
  'hevc',
  'mp3',
  'wav',
  'flac',
  'aac',
  'ac3',
  'eac3'
].join(',')

// Prevent SSRF
// A remote input (pre-signed URL...) lets nested demuxers of FFmpeg open any HTTP, TCP or UDP URL, unlike a local file
// Some of them (dash, hls, concat, sdp...) detect the format from the content and then open the URLs the file references
export function buildRemoteInputOptions (input: unknown, options: { disableFormatWhitelist?: boolean } = {}): string[] {
  if (options.disableFormatWhitelist === true) return []
  if (typeof input !== 'string' || !/^https?:\/\//i.test(input)) return []

  return [ '-format_whitelist', REMOTE_INPUT_FORMAT_WHITELIST ]
}
