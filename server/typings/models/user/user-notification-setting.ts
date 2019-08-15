import { UserNotificationSettingModel } from '@server/models/account/user-notification-setting'

export type MNotificationSetting = Omit<UserNotificationSettingModel, 'User'>
