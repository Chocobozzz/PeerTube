export const VideoRecommendationScope = {
  ALL: 1,
  // Videos of the platform that owns the referenced video
  LOCAL: 2,
  ACCOUNT: 3,
  CHANNEL: 4
} as const

export type VideoRecommendationScopeType = typeof VideoRecommendationScope[keyof typeof VideoRecommendationScope]
