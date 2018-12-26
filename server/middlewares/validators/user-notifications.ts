import * as express from 'express'
import 'express-validator'
import { body } from 'express-validator/check'
import { logger } from '../../helpers/logger'
import { areValidationErrors } from './utils'
import { isUserNotificationSettingValid } from '../../helpers/custom-validators/user-notifications'
import { isIntArray } from '../../helpers/custom-validators/misc'

const updateNotificationSettingsValidator = [
  body('newVideoFromSubscription')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new video from subscription notification setting'),
  body('newCommentOnMyVideo')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new comment on my video notification setting'),
  body('videoAbuseAsModerator')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new video abuse as moderator notification setting'),
  body('blacklistOnMyVideo')
    .custom(isUserNotificationSettingValid).withMessage('Should have a valid new blacklist on my video notification setting'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking updateNotificationSettingsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const markAsReadUserNotificationsValidator = [
  body('ids')
    .custom(isIntArray).withMessage('Should have a valid notification ids to mark as read'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking markAsReadUserNotificationsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  updateNotificationSettingsValidator,
  markAsReadUserNotificationsValidator
}
