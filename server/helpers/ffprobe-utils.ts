import * as ffmpeg from 'fluent-ffmpeg'
import { VideoFileMetadata } from '@shared/models/videos/video-file-metadata'
import { getMaxBitrate, VideoResolution } from '../../shared/models/videos'
import { CONFIG } from '../initializers/config'
import { VIDEO_TRANSCODING_FPS } from '../initializers/constants'
import { logger } from './logger'

/**
 *
 * Helpers to run ffprobe and extract data from the JSON output
 *
 */

function ffprobePromise (path: string) {
  return new Promise<ffmpeg.FfprobeData>((res, rej) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return rej(err)

      return res(data)
    })
  })
}

async function getAudioStream (videoPath: string, existingProbe?: ffmpeg.FfprobeData) {
  // without position, ffprobe considers the last input only
  // we make it consider the first input only
  // if you pass a file path to pos, then ffprobe acts on that file directly
  const data = existingProbe || await ffprobePromise(videoPath)

  if (Array.isArray(data.streams)) {
    const audioStream = data.streams.find(stream => stream['codec_type'] === 'audio')

    if (audioStream) {
      return {
        absolutePath: data.format.filename,
        audioStream,
        bitrate: parseInt(audioStream['bit_rate'] + '', 10)
      }
    }
  }

  return { absolutePath: data.format.filename }
}

function getMaxAudioBitrate (type: 'aac' | 'mp3' | string, bitrate: number) {
  const maxKBitrate = 384
  const kToBits = (kbits: number) => kbits * 1000

  // If we did not manage to get the bitrate, use an average value
  if (!bitrate) return 256

  if (type === 'aac') {
    switch (true) {
      case bitrate > kToBits(maxKBitrate):
        return maxKBitrate

      default:
        return -1 // we interpret it as a signal to copy the audio stream as is
    }
  }

  /*
    a 192kbit/sec mp3 doesn't hold as much information as a 192kbit/sec aac.
    That's why, when using aac, we can go to lower kbit/sec. The equivalences
    made here are not made to be accurate, especially with good mp3 encoders.
    */
  switch (true) {
    case bitrate <= kToBits(192):
      return 128

    case bitrate <= kToBits(384):
      return 256

    default:
      return maxKBitrate
  }
}

async function getVideoStreamSize (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const videoStream = await getVideoStreamFromFile(path, existingProbe)

  return videoStream === null
    ? { width: 0, height: 0 }
    : { width: videoStream.width, height: videoStream.height }
}

async function getVideoStreamCodec (path: string) {
  const videoStream = await getVideoStreamFromFile(path)

  if (!videoStream) return ''

  const videoCodec = videoStream.codec_tag_string

  const baseProfileMatrix = {
    High: '6400',
    Main: '4D40',
    Baseline: '42E0'
  }

  let baseProfile = baseProfileMatrix[videoStream.profile]
  if (!baseProfile) {
    logger.warn('Cannot get video profile codec of %s.', path, { videoStream })
    baseProfile = baseProfileMatrix['High'] // Fallback
  }

  let level = videoStream.level.toString(16)
  if (level.length === 1) level = `0${level}`

  return `${videoCodec}.${baseProfile}${level}`
}

async function getAudioStreamCodec (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const { audioStream } = await getAudioStream(path, existingProbe)

  if (!audioStream) return ''

  const audioCodec = audioStream.codec_name
  if (audioCodec === 'aac') return 'mp4a.40.2'

  logger.warn('Cannot get audio codec of %s.', path, { audioStream })

  return 'mp4a.40.2' // Fallback
}

async function getVideoFileResolution (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const size = await getVideoStreamSize(path, existingProbe)

  return {
    videoFileResolution: Math.min(size.height, size.width),
    isPortraitMode: size.height > size.width
  }
}

async function getVideoFileFPS (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const videoStream = await getVideoStreamFromFile(path, existingProbe)
  if (videoStream === null) return 0

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

async function getMetadataFromFile (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const metadata = existingProbe || await ffprobePromise(path)

  return new VideoFileMetadata(metadata)
}

async function getVideoFileBitrate (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const metadata = await getMetadataFromFile(path, existingProbe)

  return metadata.format.bit_rate as number
}

async function getDurationFromVideoFile (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const metadata = await getMetadataFromFile(path, existingProbe)

  return Math.round(metadata.format.duration)
}

async function getVideoStreamFromFile (path: string, existingProbe?: ffmpeg.FfprobeData) {
  const metadata = await getMetadataFromFile(path, existingProbe)

  return metadata.streams.find(s => s.codec_type === 'video') || null
}

function computeResolutionsToTranscode (videoFileResolution: number, type: 'vod' | 'live') {
  const configResolutions = type === 'vod'
    ? CONFIG.TRANSCODING.RESOLUTIONS
    : CONFIG.LIVE.TRANSCODING.RESOLUTIONS

  const resolutionsEnabled: number[] = []

  // Put in the order we want to proceed jobs
  const resolutions = [
    VideoResolution.H_NOVIDEO,
    VideoResolution.H_480P,
    VideoResolution.H_360P,
    VideoResolution.H_720P,
    VideoResolution.H_240P,
    VideoResolution.H_1080P,
    VideoResolution.H_1440P,
    VideoResolution.H_4K
  ]

  for (const resolution of resolutions) {
    if (configResolutions[resolution + 'p'] === true && videoFileResolution > resolution) {
      resolutionsEnabled.push(resolution)
    }
  }

  return resolutionsEnabled
}

async function canDoQuickTranscode (path: string): Promise<boolean> {
  const probe = await ffprobePromise(path)

  return await canDoQuickVideoTranscode(path, probe) &&
         await canDoQuickAudioTranscode(path, probe)
}

async function canDoQuickVideoTranscode (path: string, probe?: ffmpeg.FfprobeData): Promise<boolean> {
  const videoStream = await getVideoStreamFromFile(path, probe)
  const fps = await getVideoFileFPS(path, probe)
  const bitRate = await getVideoFileBitrate(path, probe)
  const resolution = await getVideoFileResolution(path, probe)

  // If ffprobe did not manage to guess the bitrate
  if (!bitRate) return false

  // check video params
  if (videoStream == null) return false
  if (videoStream['codec_name'] !== 'h264') return false
  if (videoStream['pix_fmt'] !== 'yuv420p') return false
  if (fps < VIDEO_TRANSCODING_FPS.MIN || fps > VIDEO_TRANSCODING_FPS.MAX) return false
  if (bitRate > getMaxBitrate(resolution.videoFileResolution, fps, VIDEO_TRANSCODING_FPS)) return false

  return true
}

async function canDoQuickAudioTranscode (path: string, probe?: ffmpeg.FfprobeData): Promise<boolean> {
  const parsedAudio = await getAudioStream(path, probe)

  if (!parsedAudio.audioStream) return true

  if (parsedAudio.audioStream['codec_name'] !== 'aac') return false

  const audioBitrate = parsedAudio.bitrate
  if (!audioBitrate) return false

  const maxAudioBitrate = getMaxAudioBitrate('aac', audioBitrate)
  if (maxAudioBitrate !== -1 && audioBitrate > maxAudioBitrate) return false

  return true
}

function getClosestFramerateStandard (fps: number, type: 'HD_STANDARD' | 'STANDARD'): number {
  return VIDEO_TRANSCODING_FPS[type].slice(0)
                                    .sort((a, b) => fps % a - fps % b)[0]
}

function computeFPS (fpsArg: number, resolution: VideoResolution) {
  let fps = fpsArg

  if (
    // On small/medium resolutions, limit FPS
    resolution !== undefined &&
    resolution < VIDEO_TRANSCODING_FPS.KEEP_ORIGIN_FPS_RESOLUTION_MIN &&
    fps > VIDEO_TRANSCODING_FPS.AVERAGE
  ) {
    // Get closest standard framerate by modulo: downsampling has to be done to a divisor of the nominal fps value
    fps = getClosestFramerateStandard(fps, 'STANDARD')
  }

  // Hard FPS limits
  if (fps > VIDEO_TRANSCODING_FPS.MAX) fps = getClosestFramerateStandard(fps, 'HD_STANDARD')
  else if (fps < VIDEO_TRANSCODING_FPS.MIN) fps = VIDEO_TRANSCODING_FPS.MIN

  return fps
}

// ---------------------------------------------------------------------------

export {
  getVideoStreamCodec,
  getAudioStreamCodec,
  getVideoStreamSize,
  getVideoFileResolution,
  getMetadataFromFile,
  getMaxAudioBitrate,
  getVideoStreamFromFile,
  getDurationFromVideoFile,
  getAudioStream,
  computeFPS,
  getVideoFileFPS,
  ffprobePromise,
  getClosestFramerateStandard,
  computeResolutionsToTranscode,
  getVideoFileBitrate,
  canDoQuickTranscode,
  canDoQuickVideoTranscode,
  canDoQuickAudioTranscode
}
