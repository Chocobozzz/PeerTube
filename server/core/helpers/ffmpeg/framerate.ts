import { VIDEO_TRANSCODING_FPS } from '@server/initializers/constants.js'

export function computeOutputFPS (options: {
  inputFPS: number
  resolution: number
}) {
  const { resolution } = options

  let fps = options.inputFPS

  if (
    // On small/medium resolutions, limit FPS
    resolution !== undefined &&
    resolution < VIDEO_TRANSCODING_FPS.KEEP_ORIGIN_FPS_RESOLUTION_MIN &&
    fps > VIDEO_TRANSCODING_FPS.AVERAGE
  ) {
    // Get closest standard framerate by modulo: downsampling has to be done to a divisor of the nominal fps value
    fps = getClosestFramerateStandard({ fps, type: 'STANDARD' })
  }

  if (fps < VIDEO_TRANSCODING_FPS.HARD_MIN) {
    throw new Error(`Cannot compute FPS because ${fps} is lower than our minimum value ${VIDEO_TRANSCODING_FPS.HARD_MIN}`)
  }

  // Cap min FPS
  if (fps < VIDEO_TRANSCODING_FPS.SOFT_MIN) fps = VIDEO_TRANSCODING_FPS.SOFT_MIN
  // Cap max FPS
  if (fps > VIDEO_TRANSCODING_FPS.SOFT_MAX) fps = getClosestFramerateStandard({ fps, type: 'HD_STANDARD' })

  return fps
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getClosestFramerateStandard (options: {
  fps: number
  type: 'HD_STANDARD' | 'STANDARD'
}) {
  const { fps, type } = options

  return VIDEO_TRANSCODING_FPS[type].slice(0)
                                    .sort((a, b) => fps % a - fps % b)[0]
}
