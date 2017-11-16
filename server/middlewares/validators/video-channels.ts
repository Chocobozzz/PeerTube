import { body, param } from 'express-validator/check'
import * as express from 'express'

import { checkErrors } from './utils'
import { database as db } from '../../initializers'
import {
  logger,
  isIdOrUUIDValid,
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  checkVideoChannelExists,
  checkVideoAccountExists
} from '../../helpers'
import { UserInstance } from '../../models'
import { UserRight } from '../../../shared'

const listVideoAccountChannelsValidator = [
  param('accountId').custom(isIdOrUUIDValid).withMessage('Should have a valid account id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoAccountChannelsValidator parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkVideoAccountExists(req.params.accountId, res, next)
    })
  }
]

const videoChannelsAddValidator = [
  body('name').custom(isVideoChannelNameValid).withMessage('Should have a valid name'),
  body('description').custom(isVideoChannelDescriptionValid).withMessage('Should have a valid description'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsAdd parameters', { parameters: req.body })

    checkErrors(req, res, next)
  }
]

const videoChannelsUpdateValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('name').optional().custom(isVideoChannelNameValid).withMessage('Should have a valid name'),
  body('description').optional().custom(isVideoChannelDescriptionValid).withMessage('Should have a valid description'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsUpdate parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkVideoChannelExists(req.params.id, res, () => {
        // We need to make additional checks
        if (res.locals.videoChannel.isOwned() === false) {
          return res.status(403)
            .json({ error: 'Cannot update video channel of another server' })
            .end()
        }

        if (res.locals.videoChannel.Account.userId !== res.locals.oauth.token.User.id) {
          return res.status(403)
            .json({ error: 'Cannot update video channel of another user' })
            .end()
        }

        next()
      })
    })
  }
]

const videoChannelsRemoveValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsRemove parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkVideoChannelExists(req.params.id, res, () => {
        // Check if the user who did the request is able to delete the video
        checkUserCanDeleteVideoChannel(res, () => {
          checkVideoChannelIsNotTheLastOne(res, next)
        })
      })
    })
  }
]

const videoChannelsGetValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsGet parameters', { parameters: req.params })

    checkErrors(req, res, () => {
      checkVideoChannelExists(req.params.id, res, next)
    })
  }
]

// ---------------------------------------------------------------------------

export {
  listVideoAccountChannelsValidator,
  videoChannelsAddValidator,
  videoChannelsUpdateValidator,
  videoChannelsRemoveValidator,
  videoChannelsGetValidator
}

// ---------------------------------------------------------------------------

function checkUserCanDeleteVideoChannel (res: express.Response, callback: () => void) {
  const user: UserInstance = res.locals.oauth.token.User

  // Retrieve the user who did the request
  if (res.locals.videoChannel.isOwned() === false) {
    return res.status(403)
              .json({ error: 'Cannot remove video channel of another server.' })
              .end()
  }

  // Check if the user can delete the video channel
  // The user can delete it if s/he is an admin
  // Or if s/he is the video channel's account
  if (user.hasRight(UserRight.REMOVE_ANY_VIDEO_CHANNEL) === false && res.locals.videoChannel.Account.userId !== user.id) {
    return res.status(403)
              .json({ error: 'Cannot remove video channel of another user' })
              .end()
  }

  // If we reach this comment, we can delete the video
  callback()
}

function checkVideoChannelIsNotTheLastOne (res: express.Response, callback: () => void) {
  db.VideoChannel.countByAccount(res.locals.oauth.token.User.Account.id)
    .then(count => {
      if (count <= 1) {
        return res.status(409)
          .json({ error: 'Cannot remove the last channel of this user' })
          .end()
      }

      callback()
    })
}
