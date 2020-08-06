export const enum UserNotificationSettingValue {
  NONE = 0,
  WEB = 1 << 0,
  EMAIL = 1 << 1
}

export interface UserNotificationSetting {
  abuseAsModerator: UserNotificationSettingValue
  videoAutoBlacklistAsModerator: UserNotificationSettingValue
  newUserRegistration: UserNotificationSettingValue

  newVideoFromSubscription: UserNotificationSettingValue

  blacklistOnMyVideo: UserNotificationSettingValue
  myVideoPublished: UserNotificationSettingValue
  myVideoImportFinished: UserNotificationSettingValue

  commentMention: UserNotificationSettingValue
  newCommentOnMyVideo: UserNotificationSettingValue

  newFollow: UserNotificationSettingValue
  newInstanceFollower: UserNotificationSettingValue
  autoInstanceFollowing: UserNotificationSettingValue

  abuseStateChange: UserNotificationSettingValue
  abuseNewMessage: UserNotificationSettingValue
}
