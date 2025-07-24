import { buildAspectRatio, forceNumber } from '@peertube/peertube-core-utils'
import { VideoResolution } from '@peertube/peertube-models'
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg'

/**
 * Helpers to run ffprobe and extract data from the JSON output
 */

export function ffprobePromise (path: string) {
  return new Promise<FfprobeData>((res, rej) => {
    ffmpeg.ffprobe(path, [ '-show_chapters' ], (err, data) => {
      if (err) return rej(err)

      return res(data)
    })
  })
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

const imageCodecs = new Set([
  'ansi',
  'apng',
  'bintext',
  'bmp',
  'brender_pix',
  'dpx',
  'exr',
  'fits',
  'gem',
  'gif',
  'jpeg2000',
  'jpgls',
  'mjpeg',
  'mjpegb',
  'msp2',
  'pam',
  'pbm',
  'pcx',
  'pfm',
  'pgm',
  'pgmyuv',
  'pgx',
  'photocd',
  'pictor',
  'png',
  'ppm',
  'psd',
  'sgi',
  'sunrast',
  'svg',
  'targa',
  'tiff',
  'txd',
  'webp',
  'xbin',
  'xbm',
  'xface',
  'xpm',
  'xwd'
])

export async function isAudioFile (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) return true

  if (imageCodecs.has(videoStream.codec_name)) return true

  return false
}

export async function hasAudioStream (path: string, existingProbe?: FfprobeData) {
  const { audioStream } = await getAudioStream(path, existingProbe)

  return !!audioStream
}

export async function getAudioStream (videoPath: string, existingProbe?: FfprobeData) {
  const data = existingProbe || await ffprobePromise(videoPath)

  if (Array.isArray(data.streams)) {
    const audioStream = data.streams.find(stream => stream['codec_type'] === 'audio')

    if (audioStream) {
      return {
        absolutePath: data.format.filename,
        audioStream,
        bitrate: forceNumber(audioStream['bit_rate'])
      }
    }
  }

  return { absolutePath: data.format.filename }
}

export function getMaxAudioKBitrate (type: string, bitrate: number) {
  const maxKBitrate = 384

  // If we did not manage to get the bitrate, use an average value
  if (!bitrate) {
    // We expect uploader wants a high quality audio if the input is in FLAC format
    if (type === 'flac') return maxKBitrate

    return 256
  }

  const kBitrate = Math.round(bitrate / 1000)

  if (type === 'aac') {
    if (kBitrate > maxKBitrate) return maxKBitrate

    // We interpret it as a signal to copy the audio stream as is
    return -1
  }

  return Math.min(maxKBitrate, kBitrate)
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export async function getVideoStreamDimensionsInfo (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) {
    return {
      width: 0,
      height: 0,
      ratio: 0,
      resolution: VideoResolution.H_NOVIDEO,
      isPortraitMode: false
    }
  }

  const rotation = videoStream.rotation
    ? videoStream.rotation + ''
    : undefined

  if (rotation === '90' || rotation === '-90') {
    const width = videoStream.width
    videoStream.width = videoStream.height
    videoStream.height = width
  }

  return {
    width: videoStream.width,
    height: videoStream.height,
    ratio: buildAspectRatio({ width: videoStream.width, height: videoStream.height }),
    resolution: Math.min(videoStream.height, videoStream.width),
    isPortraitMode: videoStream.height > videoStream.width
  }
}

export async function getVideoStreamFPS (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) return 0

  for (const key of [ 'avg_frame_rate', 'r_frame_rate' ]) {
    const valuesText: string = videoStream[key]
    if (!valuesText) continue

    const [ frames, seconds ] = valuesText.split('/')
    if (!frames || !seconds) continue

    const result = parseInt(frames, 10) / parseInt(seconds, 10)
    if (result > 0) return Math.round(result)
  }

  return 0
}

export async function getVideoStreamBitrate (path: string, existingProbe?: FfprobeData): Promise<number> {
  const metadata = existingProbe || await ffprobePromise(path)

  let bitrate = metadata.format.bit_rate
  if (bitrate && !isNaN(bitrate)) return bitrate

  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) return undefined

  bitrate = forceNumber(videoStream?.bit_rate)
  if (bitrate && !isNaN(bitrate)) return bitrate

  return undefined
}

export async function getVideoStreamDuration (path: string, existingProbe?: FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return Math.round(metadata.format.duration)
}

export async function getVideoStream (path: string, existingProbe?: FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return metadata.streams.find(s => s.codec_type === 'video')
}

export async function hasVideoStream (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)

  return !!videoStream
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export async function getChaptersFromContainer (options: {
  path: string
  maxTitleLength: number
  ffprobe?: FfprobeData
}) {
  const { path, maxTitleLength, ffprobe } = options

  const metadata = ffprobe || await ffprobePromise(path)

  if (!Array.isArray(metadata?.chapters)) return []

  return metadata.chapters
    .map(c => ({
      timecode: Math.round(c.start_time),
      title: (c['TAG:title'] || '').slice(0, maxTitleLength)
    }))
}
