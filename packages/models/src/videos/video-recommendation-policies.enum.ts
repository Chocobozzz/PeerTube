export const VideoRecommendationPolicy = {
  ANY_VIDEOS: 1,
  ONLY_LOCAL_VIDEOS: 2,
  ONLY_OWNER_VIDEOS: 3,
  ONLY_CHANNEL_VIDEOS: 4
} as const

export type VideoRecommendationPolicyType = typeof VideoRecommendationPolicy[keyof typeof VideoRecommendationPolicy]
