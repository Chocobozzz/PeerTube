import * as express from 'express'
import { body, param, query } from 'express-validator'
import { VIDEO_CHANNELS } from '@server/initializers/constants'
import { MChannelAccountDefault, MUser } from '@server/types/models'
import { UserRight } from '../../../../shared'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { isActorPreferredUsernameValid } from '../../../helpers/custom-validators/activitypub/actor'
import { isBooleanValid, toBooleanOrNull } from '../../../helpers/custom-validators/misc'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelNameValid,
  isVideoChannelSupportValid
} from '../../../helpers/custom-validators/video-channels'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/actor/actor'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { areValidationErrors, doesLocalVideoChannelNameExist, doesVideoChannelNameWithHostExist } from '../shared'

const videoChannelsAddValidator = [
  body('name').custom(isActorPreferredUsernameValid).withMessage('Should have a valid channel name'),
  body('displayName').custom(isVideoChannelNameValid).withMessage('Should have a valid display name'),
  body('description').optional().custom(isVideoChannelDescriptionValid).withMessage('Should have a valid description'),
  body('support').optional().custom(isVideoChannelSupportValid).withMessage('Should have a valid support text'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsAdd parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const actor = await ActorModel.loadLocalByName(req.body.name)
    if (actor) {
      res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: 'Another actor (account/channel) with this name on this instance already exists or has already existed.'
      })
      return false
    }

    const count = await VideoChannelModel.countByAccount(res.locals.oauth.token.User.Account.id)
    if (count >= VIDEO_CHANNELS.MAX_PER_USER) {
      res.fail({ message: `You cannot create more than ${VIDEO_CHANNELS.MAX_PER_USER} channels` })
      return false
    }

    return next()
  }
]

const videoChannelsUpdateValidator = [
  param('nameWithHost').exists().withMessage('Should have an video channel name with host'),
  body('displayName')
    .optional()
    .custom(isVideoChannelNameValid).withMessage('Should have a valid display name'),
  body('description')
    .optional()
    .custom(isVideoChannelDescriptionValid).withMessage('Should have a valid description'),
  body('support')
    .optional()
    .custom(isVideoChannelSupportValid).withMessage('Should have a valid support text'),
  body('bulkVideosSupportUpdate')
    .optional()
    .custom(isBooleanValid).withMessage('Should have a valid bulkVideosSupportUpdate boolean field'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoChannelNameWithHostExist(req.params.nameWithHost, res)) return

    // We need to make additional checks
    if (res.locals.videoChannel.Actor.isOwned() === false) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Cannot update video channel of another server'
      })
    }

    if (res.locals.videoChannel.Account.userId !== res.locals.oauth.token.User.id) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Cannot update video channel of another user'
      })
    }

    return next()
  }
]

const videoChannelsRemoveValidator = [
  param('nameWithHost').exists().withMessage('Should have an video channel name with host'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsRemove parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoChannelNameWithHostExist(req.params.nameWithHost, res)) return

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

    if (!await doesVideoChannelNameWithHostExist(req.params.nameWithHost, res)) return

    return next()
  }
]

const localVideoChannelValidator = [
  param('name').custom(isVideoChannelNameValid).withMessage('Should have a valid video channel name'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking localVideoChannelValidator parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesLocalVideoChannelNameExist(req.params.name, res)) return

    return next()
  }
]

const videoChannelStatsValidator = [
  query('withStats')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid stats flag'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    return next()
  }
]

const videoChannelsListValidator = [
  query('search').optional().not().isEmpty().withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking video channels search query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoChannelsAddValidator,
  videoChannelsUpdateValidator,
  videoChannelsRemoveValidator,
  videoChannelsNameWithHostValidator,
  videoChannelsListValidator,
  localVideoChannelValidator,
  videoChannelStatsValidator
}

// ---------------------------------------------------------------------------

function checkUserCanDeleteVideoChannel (user: MUser, videoChannel: MChannelAccountDefault, res: express.Response) {
  if (videoChannel.Actor.isOwned() === false) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot remove video channel of another server.'
    })
    return false
  }

  // Check if the user can delete the video channel
  // The user can delete it if s/he is an admin
  // Or if s/he is the video channel's account
  if (user.hasRight(UserRight.REMOVE_ANY_VIDEO_CHANNEL) === false && videoChannel.Account.userId !== user.id) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot remove video channel of another user'
    })
    return false
  }

  return true
}

async function checkVideoChannelIsNotTheLastOne (res: express.Response) {
  const count = await VideoChannelModel.countByAccount(res.locals.oauth.token.User.Account.id)

  if (count <= 1) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Cannot remove the last channel of this user'
    })
    return false
  }

  return true
}
