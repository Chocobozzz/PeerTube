export const AbuseState = {
  PENDING: 1,
  REJECTED: 2,
  ACCEPTED: 3
} as const

export type AbuseStateType = typeof AbuseState[keyof typeof AbuseState]
