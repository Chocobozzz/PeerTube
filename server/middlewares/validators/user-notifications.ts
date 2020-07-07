import * as express from 'express'
import { body, query } from 'express-validator'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isUserNotificationSettingValid } from '../../helpers/custom-validators/user-notifications'
import { isNotEmptyIntArray, toBooleanOrNull } from '../../helpers/custom-validators/misc'

const listUserNotificationsValidator = [
  query('unread')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .isBoolean().withMessage('Should have a valid unread boolean'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listUserNotificationsValidator parameters', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const updateNotificationSettingsValidator = [
  body('newVideoFromSubscription')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new video from subscription notification setting'),
  body('newCommentOnMyVideo')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new comment on my video notification setting'),
  body('abuseAsModerator')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid abuse as moderator notification setting'),
  body('videoAutoBlacklistAsModerator')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid video auto blacklist notification setting'),
  body('blacklistOnMyVideo')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new blacklist on my video notification setting'),
  body('myVideoImportFinished')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid video import finished video notification setting'),
  body('myVideoPublished')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid video published notification setting'),
  body('commentMention')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid comment mention notification setting'),
  body('newFollow')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new follow notification setting'),
  body('newUserRegistration')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new user registration notification setting'),
  body('newInstanceFollower')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new instance follower notification setting'),
  body('autoInstanceFollowing')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new instance following notification setting'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking updateNotificationSettingsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const markAsReadUserNotificationsValidator = [
  body('ids')
    .optional()
    .custom(isNotEmptyIntArray).withMessage('Should have a valid notification ids to mark as read'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking markAsReadUserNotificationsValidator parameters', { parameters: req.body })

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
