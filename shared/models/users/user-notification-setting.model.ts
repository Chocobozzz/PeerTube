export enum UserNotificationSettingValue {
  NONE = 0,
  WEB = 1 << 0,
  EMAIL = 1 << 1
}

export interface UserNotificationSetting {
  newVideoFromSubscription: UserNotificationSettingValue
  newCommentOnMyVideo: UserNotificationSettingValue
  videoAbuseAsModerator: UserNotificationSettingValue
  videoAutoBlacklistAsModerator: UserNotificationSettingValue
  blacklistOnMyVideo: UserNotificationSettingValue
  myVideoPublished: UserNotificationSettingValue
  myVideoImportFinished: UserNotificationSettingValue
  newUserRegistration: UserNotificationSettingValue
  newFollow: UserNotificationSettingValue
  commentMention: UserNotificationSettingValue
  newInstanceFollower: UserNotificationSettingValue
  autoInstanceFollowing: UserNotificationSettingValue
}
