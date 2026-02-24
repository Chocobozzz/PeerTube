export const VideoEmbedPrivacyPolicy = {
  ALL_ALLOWED: 1,
  ALLOWLIST: 2,

  // Federated server imposes restrictions on the embed
  REMOTE_RESTRICTIONS: 3
} as const

export type VideoEmbedPrivacyPolicyType = typeof VideoEmbedPrivacyPolicy[keyof typeof VideoEmbedPrivacyPolicy]
