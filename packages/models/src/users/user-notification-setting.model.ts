export const UserNotificationSettingValue = {
  NONE: 0,
  WEB: 1 << 0,
  EMAIL: 1 << 1
} as const

export type UserNotificationSettingValueType = typeof UserNotificationSettingValue[keyof typeof UserNotificationSettingValue]

export interface UserNotificationSetting {
  abuseAsModerator: UserNotificationSettingValueType
  videoAutoBlacklistAsModerator: UserNotificationSettingValueType
  newUserRegistration: UserNotificationSettingValueType

  newVideoFromSubscription: UserNotificationSettingValueType

  blacklistOnMyVideo: UserNotificationSettingValueType
  myVideoPublished: UserNotificationSettingValueType
  myVideoImportFinished: UserNotificationSettingValueType

  commentMention: UserNotificationSettingValueType
  newCommentOnMyVideo: UserNotificationSettingValueType

  newFollow: UserNotificationSettingValueType
  newInstanceFollower: UserNotificationSettingValueType
  autoInstanceFollowing: UserNotificationSettingValueType

  abuseStateChange: UserNotificationSettingValueType
  abuseNewMessage: UserNotificationSettingValueType

  newPeerTubeVersion: UserNotificationSettingValueType
  newPluginVersion: UserNotificationSettingValueType

  myVideoStudioEditionFinished: UserNotificationSettingValueType

  myVideoTranscriptionGenerated: UserNotificationSettingValueType
}
