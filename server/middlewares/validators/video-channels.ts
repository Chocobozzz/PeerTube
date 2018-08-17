import * as express from 'express'
import { body, param } from 'express-validator/check'
import { UserRight } from '../../../shared'
import { isAccountNameWithHostExist } from '../../helpers/custom-validators/accounts'
import {
  isLocalVideoChannelNameExist,
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelNameWithHostExist,
  isVideoChannelSupportValid
} from '../../helpers/custom-validators/video-channels'
import { logger } from '../../helpers/logger'
import { UserModel } from '../../models/account/user'
import { VideoChannelModel } from '../../models/video/video-channel'
import { areValidationErrors } from './utils'
import { isActorPreferredUsernameValid } from '../../helpers/custom-validators/activitypub/actor'

const listVideoAccountChannelsValidator = [
  param('accountName').exists().withMessage('Should have a valid account name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking listVideoAccountChannelsValidator parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isAccountNameWithHostExist(req.params.accountName, res)) return

    return next()
  }
]

const videoChannelsAddValidator = [
  body('name').custom(isActorPreferredUsernameValid).withMessage('Should have a valid channel name'),
  body('displayName').custom(isVideoChannelNameValid).withMessage('Should have a valid display name'),
  body('description').optional().custom(isVideoChannelDescriptionValid).withMessage('Should have a valid description'),
  body('support').optional().custom(isVideoChannelSupportValid).withMessage('Should have a valid support text'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsAdd parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoChannelsUpdateValidator = [
  param('nameWithHost').exists().withMessage('Should have an video channel name with host'),
  body('displayName').optional().custom(isVideoChannelNameValid).withMessage('Should have a valid display name'),
  body('description').optional().custom(isVideoChannelDescriptionValid).withMessage('Should have a valid description'),
  body('support').optional().custom(isVideoChannelSupportValid).withMessage('Should have a valid support text'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoChannelNameWithHostExist(req.params.nameWithHost, res)) return

    // We need to make additional checks
    if (res.locals.videoChannel.Actor.isOwned() === false) {
      return res.status(403)
        .json({ error: 'Cannot update video channel of another server' })
        .end()
    }

    if (res.locals.videoChannel.Account.userId !== res.locals.oauth.token.User.id) {
      return res.status(403)
        .json({ error: 'Cannot update video channel of another user' })
        .end()
    }

    return next()
  }
]

const videoChannelsRemoveValidator = [
  param('nameWithHost').exists().withMessage('Should have an video channel name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsRemove parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoChannelNameWithHostExist(req.params.nameWithHost, res)) return

    if (!checkUserCanDeleteVideoChannel(res.locals.oauth.token.User, res.locals.videoChannel, res)) return
    if (!await checkVideoChannelIsNotTheLastOne(res)) return

    return next()
  }
]

const videoChannelsNameWithHostValidator = [
  param('nameWithHost').exists().withMessage('Should have an video channel name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsNameWithHostValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return

    if (!await isVideoChannelNameWithHostExist(req.params.nameWithHost, res)) return

    return next()
  }
]

const localVideoChannelValidator = [
  param('name').custom(isVideoChannelNameValid).withMessage('Should have a valid video channel name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking localVideoChannelValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isLocalVideoChannelNameExist(req.params.name, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  listVideoAccountChannelsValidator,
  videoChannelsAddValidator,
  videoChannelsUpdateValidator,
  videoChannelsRemoveValidator,
  videoChannelsNameWithHostValidator,
  localVideoChannelValidator
}

// ---------------------------------------------------------------------------

function checkUserCanDeleteVideoChannel (user: UserModel, videoChannel: VideoChannelModel, res: express.Response) {
  if (videoChannel.Actor.isOwned() === false) {
    res.status(403)
              .json({ error: 'Cannot remove video channel of another server.' })
              .end()

    return false
  }

  // Check if the user can delete the video channel
  // The user can delete it if s/he is an admin
  // Or if s/he is the video channel's account
  if (user.hasRight(UserRight.REMOVE_ANY_VIDEO_CHANNEL) === false && videoChannel.Account.userId !== user.id) {
    res.status(403)
              .json({ error: 'Cannot remove video channel of another user' })
              .end()

    return false
  }

  return true
}

async function checkVideoChannelIsNotTheLastOne (res: express.Response) {
  const count = await VideoChannelModel.countByAccount(res.locals.oauth.token.User.Account.id)

  if (count <= 1) {
    res.status(409)
      .json({ error: 'Cannot remove the last channel of this user' })
      .end()

    return false
  }

  return true
}
