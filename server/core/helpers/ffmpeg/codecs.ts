import { FfprobeData } from 'fluent-ffmpeg'
import { getAudioStream, getVideoStream } from '@peertube/peertube-ffmpeg'
import { logger } from '../logger.js'
import { forceNumber } from '@peertube/peertube-core-utils'

export async function getVideoStreamCodec (path: string, existingProbe?: FfprobeData) {
  const videoStream = await getVideoStream(path, existingProbe)
  if (!videoStream) return ''

  const videoCodec = videoStream.codec_tag_string

  if (videoCodec === 'vp09') return 'vp09.00.50.08'
  if (videoCodec === 'hev1') return 'hev1.1.6.L93.B0'

  const baseProfileMatrix = {
    avc1: {
      High: '6400',
      Main: '4D40',
      Baseline: '42E0'
    },
    av01: {
      High: '1',
      Main: '0',
      Professional: '2'
    }
  }

  let baseProfile = baseProfileMatrix[videoCodec][videoStream.profile]
  if (!baseProfile) {
    logger.warn('Cannot get video profile codec of %s.', path, { videoStream })
    baseProfile = baseProfileMatrix[videoCodec]['High'] // Fallback
  }

  if (videoCodec === 'av01') {
    let level = videoStream.level.toString()
    if (level.length === 1) level = `0${level}`

    // Guess the tier indicator and bit depth
    return `${videoCodec}.${baseProfile}.${level}M.08`
  }

  let level = forceNumber(videoStream.level).toString(16)
  if (level.length === 1) level = `0${level}`

  // Default, h264 codec
  return `${videoCodec}.${baseProfile}${level}`
}

export async function getAudioStreamCodec (path: string, existingProbe?: FfprobeData) {
  const { audioStream } = await getAudioStream(path, existingProbe)

  if (!audioStream) return ''

  const audioCodecName = audioStream.codec_name

  if (audioCodecName === 'opus') return 'opus'
  if (audioCodecName === 'vorbis') return 'vorbis'
  if (audioCodecName === 'aac') return 'mp4a.40.2'
  if (audioCodecName === 'mp3') return 'mp4a.40.34'

  logger.warn('Cannot get audio codec of %s.', path, { audioStream })

  return 'mp4a.40.2' // Fallback
}
