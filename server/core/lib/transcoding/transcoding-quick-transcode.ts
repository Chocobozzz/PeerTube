import { FfprobeData } from 'fluent-ffmpeg'
import { CONFIG } from '@server/initializers/config.js'
import { canDoQuickAudioTranscode, canDoQuickVideoTranscode, ffprobePromise } from '@peertube/peertube-ffmpeg'

// Input codecs the admin allows to remux (copy) instead of re-encoding
export function getEnabledRemuxVideoCodecs () {
  const codecs: string[] = []

  if (CONFIG.TRANSCODING.REMUX.H264) codecs.push('h264')
  if (CONFIG.TRANSCODING.REMUX.AV1) codecs.push('av1')
  if (CONFIG.TRANSCODING.REMUX.VP9) codecs.push('vp9')

  return codecs
}

export function getEnabledRemuxAudioCodecs () {
  // aac is the baseline web audio codec and is always remuxable
  const codecs: string[] = [ 'aac' ]

  if (CONFIG.TRANSCODING.REMUX.OPUS) codecs.push('opus')

  return codecs
}

export async function canDoQuickTranscode (path: string, maxFPS: number, existingProbe?: FfprobeData): Promise<boolean> {
  if (CONFIG.TRANSCODING.PROFILE !== 'default') return false

  const probe = existingProbe || await ffprobePromise(path)

  return await canDoQuickVideoTranscode(path, maxFPS, probe, getEnabledRemuxVideoCodecs()) &&
         await canDoQuickAudioTranscode(path, probe, getEnabledRemuxAudioCodecs())
}
