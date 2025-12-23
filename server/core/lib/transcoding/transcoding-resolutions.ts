import { toEven } from '@peertube/peertube-core-utils'
import { VideoResolution, VideoResolutionType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'

export function buildOriginalFileResolution (inputResolution: number) {
  if (CONFIG.TRANSCODING.ALWAYS_TRANSCODE_ORIGINAL_RESOLUTION === true) {
    return toEven(inputResolution)
  }

  const resolutions = computeResolutionsToTranscode({
    input: inputResolution,
    type: 'vod',
    includeInput: false,
    strictLower: false,
    // We don't really care about the audio resolution in this context
    hasAudio: true
  })

  if (
    resolutions.length === 0 ||
    (resolutions.length === 1 && resolutions[0] === VideoResolution.H_NOVIDEO)
  ) {
    return toEven(inputResolution)
  }

  return Math.max(...resolutions)
}

export function computeResolutionsToTranscode (options: {
  input: number
  type: 'vod' | 'live'
  includeInput: boolean
  strictLower: boolean
  hasAudio: boolean
}) {
  const { input, type, includeInput, strictLower, hasAudio } = options

  const configResolutions = type === 'vod'
    ? CONFIG.TRANSCODING.RESOLUTIONS
    : CONFIG.LIVE.TRANSCODING.RESOLUTIONS

  const resolutionsEnabled = new Set<number>()

  // Put in the order we want to proceed jobs
  const availableResolutions: VideoResolutionType[] = [
    VideoResolution.H_NOVIDEO,
    VideoResolution.H_480P,
    VideoResolution.H_360P,
    VideoResolution.H_720P,
    VideoResolution.H_240P,
    VideoResolution.H_144P,
    VideoResolution.H_1080P,
    VideoResolution.H_1440P,
    VideoResolution.H_4K
  ]

  for (const resolution of availableResolutions) {
    // Resolution not enabled
    if (configResolutions[resolution + 'p'] !== true) continue
    // Too big resolution for input file
    if (input < resolution) continue
    // We only want lower resolutions than input file
    if (strictLower && input === resolution) continue
    // Audio resolution but no audio in the video
    if (resolution === VideoResolution.H_NOVIDEO && !hasAudio) continue

    resolutionsEnabled.add(resolution)
  }

  if (includeInput) {
    // Always use an even resolution to avoid issues with ffmpeg
    resolutionsEnabled.add(toEven(input))
  }

  return Array.from(resolutionsEnabled)
}
