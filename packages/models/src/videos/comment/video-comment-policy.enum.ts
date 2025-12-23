export const VideoCommentPolicy = {
  ENABLED: 1,
  DISABLED: 2,
  REQUIRES_APPROVAL: 3
} as const

export type VideoCommentPolicyType = typeof VideoCommentPolicy[keyof typeof VideoCommentPolicy]
