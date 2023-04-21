import { FfprobeData } from 'fluent-ffmpeg'
import { CONFIG } from '@server/initializers/config'
import { VIDEO_TRANSCODING_FPS } from '@server/initializers/constants'
import { getMaxBitrate } from '@shared/core-utils'
import {
  ffprobePromise,
  getAudioStream,
  getMaxAudioBitrate,
  getVideoStream,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS
} from '@shared/ffmpeg'

export async function canDoQuickTranscode (path: string, existingProbe?: FfprobeData): Promise<boolean> {
  if (CONFIG.TRANSCODING.PROFILE !== 'default') return false

  const probe = existingProbe || await ffprobePromise(path)

  return await canDoQuickVideoTranscode(path, probe) &&
         await canDoQuickAudioTranscode(path, probe)
}

export async function canDoQuickAudioTranscode (path: string, probe?: FfprobeData): Promise<boolean> {
  const parsedAudio = await getAudioStream(path, probe)

  if (!parsedAudio.audioStream) return true

  if (parsedAudio.audioStream['codec_name'] !== 'aac') return false

  const audioBitrate = parsedAudio.bitrate
  if (!audioBitrate) return false

  const maxAudioBitrate = getMaxAudioBitrate('aac', audioBitrate)
  if (maxAudioBitrate !== -1 && audioBitrate > maxAudioBitrate) return false

  const channelLayout = parsedAudio.audioStream['channel_layout']
  // Causes playback issues with Chrome
  if (!channelLayout || channelLayout === 'unknown' || channelLayout === 'quad') return false

  return true
}

export async function canDoQuickVideoTranscode (path: string, probe?: FfprobeData): Promise<boolean> {
  const videoStream = await getVideoStream(path, probe)
  const fps = await getVideoStreamFPS(path, probe)
  const bitRate = await getVideoStreamBitrate(path, probe)
  const resolutionData = await getVideoStreamDimensionsInfo(path, probe)

  // If ffprobe did not manage to guess the bitrate
  if (!bitRate) return false

  // check video params
  if (!videoStream) return false
  if (videoStream['codec_name'] !== 'h264') return false
  if (videoStream['pix_fmt'] !== 'yuv420p') return false
  if (fps < VIDEO_TRANSCODING_FPS.MIN || fps > VIDEO_TRANSCODING_FPS.MAX) return false
  if (bitRate > getMaxBitrate({ ...resolutionData, fps })) return false

  return true
}
