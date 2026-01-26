export const VideoLicence = {
  'CC-BY': 1,
  'CC-BY-SA': 2,
  'CC-BY-ND': 3,
  'CC-BY-NC': 4,
  'CC-BY-NC-SA': 5,
  'CC-BY-NC-ND': 6,
  'CC0': 7,
  'PDM': 8,
  'COPYRIGHT': 9
} as const

export type VideoLicenceType = typeof VideoLicence[keyof typeof VideoLicence]
