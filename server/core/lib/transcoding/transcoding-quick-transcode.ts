import { FfprobeData } from 'fluent-ffmpeg'
import { CONFIG } from '@server/initializers/config.js'
import { canDoQuickAudioTranscode, canDoQuickVideoTranscode, ffprobePromise } from '@peertube/peertube-ffmpeg'

export async function canDoQuickTranscode (path: string, existingProbe?: FfprobeData): Promise<boolean> {
  if (CONFIG.TRANSCODING.PROFILE !== 'default') return false

  const probe = existingProbe || await ffprobePromise(path)

  return await canDoQuickVideoTranscode(path, probe) &&
         await canDoQuickAudioTranscode(path, probe)
}
