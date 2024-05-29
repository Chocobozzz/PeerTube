export type VideoTranscodingFPS = {
  // Refuse videos with FPS below this limit
  HARD_MIN: number
  // Cap FPS to this min value
  SOFT_MIN: number

  STANDARD: number[]
  HD_STANDARD: number[]

  AUDIO_MERGE: number

  AVERAGE: number

  // Cap FPS to this max value
  SOFT_MAX: number

  KEEP_ORIGIN_FPS_RESOLUTION_MIN: number
}
