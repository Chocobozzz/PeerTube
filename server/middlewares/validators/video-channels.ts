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
  checkVideoAuthorExists
} from '../../helpers'

const listVideoAuthorChannelsValidator = [
  param('authorId').custom(isIdOrUUIDValid).withMessage('Should have a valid author id'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoAuthorChannelsValidator parameters', { parameters: req.body })

    checkErrors(req, res, () => {
      checkVideoAuthorExists(req.params.authorId, res, next)
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
            .json({ error: 'Cannot update video channel of another pod' })
            .end()
        }

        if (res.locals.videoChannel.Author.userId !== res.locals.oauth.token.User.id) {
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

const videoChannelGetValidator = [
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
  listVideoAuthorChannelsValidator,
  videoChannelsAddValidator,
  videoChannelsUpdateValidator,
  videoChannelsRemoveValidator,
  videoChannelGetValidator
}

// ---------------------------------------------------------------------------

function checkUserCanDeleteVideoChannel (res: express.Response, callback: () => void) {
  const user = res.locals.oauth.token.User

  // Retrieve the user who did the request
  if (res.locals.videoChannel.isOwned() === false) {
    return res.status(403)
              .json({ error: 'Cannot remove video channel of another pod.' })
              .end()
  }

  // Check if the user can delete the video channel
  // The user can delete it if s/he is an admin
  // Or if s/he is the video channel's author
  if (user.isAdmin() === false && res.locals.videoChannel.Author.userId !== user.id) {
    return res.status(403)
              .json({ error: 'Cannot remove video channel of another user' })
              .end()
  }

  // If we reach this comment, we can delete the video
  callback()
}

function checkVideoChannelIsNotTheLastOne (res: express.Response, callback: () => void) {
  db.VideoChannel.countByAuthor(res.locals.oauth.token.User.Author.id)
    .then(count => {
      if (count <= 1) {
        return res.status(409)
          .json({ error: 'Cannot remove the last channel of this user' })
          .end()
      }

      callback()
    })
}
