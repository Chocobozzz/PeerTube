import { FfprobeData } from 'fluent-ffmpeg'
import { CONFIG } from '@server/initializers/config.js'
import { canDoQuickAudioTranscode, canDoQuickVideoTranscode, ffprobePromise } from '@peertube/peertube-ffmpeg'
import { VideoTranscodingProfilesManager } from './default-transcoding-profiles.js'

export async function canDoQuickTranscode (path: string, maxFPS: number, existingProbe?: FfprobeData): Promise<boolean> {
  if (CONFIG.TRANSCODING.PROFILE !== 'default') return false

  const probe = existingProbe || await ffprobePromise(path)

  return await canDoQuickVideoTranscode(path, maxFPS, probe, { reEncodeKeepsStereo3D: doesReEncodeKeepsStereo3D() }) &&
    await canDoQuickAudioTranscode(path, probe)
}

export function doesReEncodeKeepsStereo3D () {
  // Encoders and builders of plugins may not keep 3D packing of the input
  return VideoTranscodingProfilesManager.Instance.isDefaultVODVideoBuilderUsed(CONFIG.TRANSCODING.PROFILE)
}
