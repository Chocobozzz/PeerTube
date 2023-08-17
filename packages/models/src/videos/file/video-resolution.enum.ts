export const VideoResolution = {
  H_NOVIDEO: 0,
  H_144P: 144,
  H_240P: 240,
  H_360P: 360,
  H_480P: 480,
  H_720P: 720,
  H_1080P: 1080,
  H_1440P: 1440,
  H_4K: 2160
} as const

export type VideoResolutionType = typeof VideoResolution[keyof typeof VideoResolution]
