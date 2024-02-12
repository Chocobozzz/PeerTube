import express from 'express'
import { body, query } from 'express-validator'
import { isNotEmptyIntArray, toBooleanOrNull } from '../../../helpers/custom-validators/misc.js'
import { isUserNotificationSettingValid } from '../../../helpers/custom-validators/user-notifications.js'
import { areValidationErrors } from '../shared/index.js'

const listUserNotificationsValidator = [
  query('unread')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .isBoolean().withMessage('Should have a valid unread boolean'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const updateNotificationSettingsValidator = [
  body('newVideoFromSubscription')
    .custom(isUserNotificationSettingValid),
  body('newCommentOnMyVideo')
    .custom(isUserNotificationSettingValid),
  body('abuseAsModerator')
    .custom(isUserNotificationSettingValid),
  body('videoAutoBlacklistAsModerator')
    .custom(isUserNotificationSettingValid),
  body('blacklistOnMyVideo')
    .custom(isUserNotificationSettingValid),
  body('myVideoImportFinished')
    .custom(isUserNotificationSettingValid),
  body('myVideoPublished')
    .custom(isUserNotificationSettingValid),
  body('commentMention')
    .custom(isUserNotificationSettingValid),
  body('newFollow')
    .custom(isUserNotificationSettingValid),
  body('newUserRegistration')
    .custom(isUserNotificationSettingValid),
  body('newInstanceFollower')
    .custom(isUserNotificationSettingValid),
  body('autoInstanceFollowing')
    .custom(isUserNotificationSettingValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

const markAsReadUserNotificationsValidator = [
  body('ids')
    .optional()
    .custom(isNotEmptyIntArray).withMessage('Should have a valid array of notification ids'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listUserNotificationsValidator,
  updateNotificationSettingsValidator,
  markAsReadUserNotificationsValidator
}
