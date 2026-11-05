export const UserSignupClient = {
  PEERTUBE_APP: 'peertube-app'
} as const

export type UserSignupClientType = typeof UserSignupClient[keyof typeof UserSignupClient]
