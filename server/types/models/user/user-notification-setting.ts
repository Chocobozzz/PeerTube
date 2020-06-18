import { UserNotificationSettingModel } from '@server/models/account/user-notification-setting'

export type MNotificationSetting = Omit<UserNotificationSettingModel, 'User'>

// ############################################################################

// Format for API or AP object

export type MNotificationSettingFormattable = MNotificationSetting
