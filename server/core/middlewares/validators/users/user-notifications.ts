import { arrayify } from '@peertube/peertube-core-utils'
import { isNumberArray } from '@server/helpers/custom-validators/search.js'
import express from 'express'
import { body, query } from 'express-validator'
import { isNotEmptyIntArray, toBooleanOrNull } from '../../../helpers/custom-validators/misc.js'
import { isUserNotificationSettingValid } from '../../../helpers/custom-validators/user-notifications.js'
import { areValidationErrors } from '../shared/index.js'

export const listUserNotificationsValidator = [
  query('unread')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .isBoolean().withMessage('Should have a valid unread boolean'),

  query('typeOneOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isNumberArray).withMessage('Should have a valid typeOneOf array'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const updateNotificationSettingsValidator = [
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

export const markAsReadUserNotificationsValidator = [
  body('ids')
    .optional()
    .custom(isNotEmptyIntArray).withMessage('Should have a valid array of notification ids'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]
