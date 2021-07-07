import validator from 'validator'
import { UserNotificationSettingValue } from '../../../shared/models/users/user-notification-setting.model'
import { exists } from './misc'

function isUserNotificationTypeValid (value: any) {
  return exists(value) && validator.isInt('' + value)
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
