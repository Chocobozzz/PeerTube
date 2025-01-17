import { VideoResolution } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { logger } from '../logger.js'

export function computeOutputFPS (options: {
  inputFPS: number
  isOriginResolution: boolean
  resolution: number
  type: 'vod' | 'live'
}) {
  const { resolution, isOriginResolution, type } = options

  if (resolution === VideoResolution.H_NOVIDEO) return 0

  const settings = type === 'vod'
    ? buildTranscodingFPSOptions(CONFIG.TRANSCODING.FPS.MAX)
    : buildTranscodingFPSOptions(CONFIG.LIVE.TRANSCODING.FPS.MAX)

  let fps = options.inputFPS

  if (
    // On small/medium transcoded resolutions, limit FPS
    !isOriginResolution &&
    resolution !== undefined &&
    resolution < settings.KEEP_ORIGIN_FPS_RESOLUTION_MIN &&
    fps > settings.AVERAGE
  ) {
    // Get closest standard framerate by modulo: downsampling has to be done to a divisor of the nominal fps value
    fps = getClosestFramerate({ fps, settings, type: 'STANDARD' })
  }

  if (fps < settings.HARD_MIN) {
    throw new Error(`Cannot compute FPS because ${fps} is lower than our minimum value ${settings.HARD_MIN}`)
  }

  // Cap min FPS
  fps = Math.max(fps, settings.TRANSCODED_MIN)

  // Cap max FPS
  if (fps > settings.TRANSCODED_MAX) {
    fps = getClosestFramerate({ fps, settings, type: 'HD_STANDARD' })
  }

  logger.debug(`Computed output FPS ${fps} for resolution ${resolution}p`, { options, settings })

  return fps
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildTranscodingFPSOptions (maxFPS: number) {
  const STANDARD = [ 24, 25, 30 ].filter(v => v <= maxFPS)
  if (STANDARD.length === 0) STANDARD.push(maxFPS)

  const HD_STANDARD = [ 50, 60, maxFPS ].filter(v => v <= maxFPS)

  return {
    HARD_MIN: 0.1,

    TRANSCODED_MIN: 1,

    TRANSCODED_MAX: maxFPS,

    STANDARD,
    HD_STANDARD,

    AVERAGE: Math.min(30, maxFPS),

    KEEP_ORIGIN_FPS_RESOLUTION_MIN: 720 // We keep the original FPS on high resolutions (720 minimum)
  }
}

function getClosestFramerate (options: {
  fps: number
  settings: ReturnType<typeof buildTranscodingFPSOptions>
  type: Extract<keyof ReturnType<typeof buildTranscodingFPSOptions>, 'HD_STANDARD' | 'STANDARD'>
}) {
  const { fps, settings, type } = options

  const copy = [ ...settings[type] ]

  // Biggest FPS first
  const descSorted = copy.sort((a, b) => b - a)
  // Find biggest FPS that can be divided by input FPS
  const found = descSorted.find(e => fps % e === 0)

  if (found) return found

  // Approximation to the best result
  return copy.sort((a, b) => fps % a - fps % b)[0]
}
