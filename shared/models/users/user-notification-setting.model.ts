export enum UserNotificationSettingValue {
  NONE = 1,
  WEB_NOTIFICATION = 2,
  EMAIL = 3,
  WEB_NOTIFICATION_AND_EMAIL = 4
}

export interface UserNotificationSetting {
  newVideoFromSubscription: UserNotificationSettingValue
  newCommentOnMyVideo: UserNotificationSettingValue
  videoAbuseAsModerator: UserNotificationSettingValue
  blacklistOnMyVideo: UserNotificationSettingValue
}
