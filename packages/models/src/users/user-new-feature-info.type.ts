export const UserNewFeatureInfo = {
  NONE: 0,
  CHANNEL_COLLABORATION: 1 << 0
} as const

export type UserNewFeatureInfoType = typeof UserNewFeatureInfo[keyof typeof UserNewFeatureInfo]
