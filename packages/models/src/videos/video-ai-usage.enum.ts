export const VideoAIUsage = {
  NOT_SPECIFIED: 1,
  NO_AI: 2,
  CONTAINS_AI: 3,
  AI_GENERATED: 4
} as const

export type VideoAIUsageType = typeof VideoAIUsage[keyof typeof VideoAIUsage]
