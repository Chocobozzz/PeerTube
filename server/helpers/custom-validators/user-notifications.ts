import { exists } from './misc'
import validator from 'validator'
import { UserNotificationType } from '../../../shared/models/users'
import { UserNotificationSettingValue } from '../../../shared/models/users/user-notification-setting.model'

function isUserNotificationTypeValid (value: any) {
  return exists(value) && validator.isInt('' + value) && UserNotificationType[value] !== undefined
}

function isUserNotificationSettingValid (value: any) {
  return exists(value) &&
    validator.isInt('' + value) &&
    (
      value === UserNotificationSettingValue.NONE ||
      value === UserNotificationSettingValue.WEB ||
      value === UserNotificationSettingValue.EMAIL ||
      value === (UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL)
    )
}

export {
  isUserNotificationSettingValid,
  isUserNotificationTypeValid
}
