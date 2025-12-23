export const AutomaticTagPolicy = {
  NONE: 1,
  REVIEW_COMMENT: 2
} as const

export type AutomaticTagPolicyType = typeof AutomaticTagPolicy[keyof typeof AutomaticTagPolicy]
