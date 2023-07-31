export const VideoPrivacy = {
  PUBLIC: 1,
  UNLISTED: 2,
  PRIVATE: 3,
  INTERNAL: 4,
  PASSWORD_PROTECTED: 5
} as const

export type VideoPrivacyType = typeof VideoPrivacy[keyof typeof VideoPrivacy]
