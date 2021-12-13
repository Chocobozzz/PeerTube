import express from 'express'
import { body, param, query } from 'express-validator'
import { CONFIG } from '@server/initializers/config'
import { MChannelAccountDefault } from '@server/types/models'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { isBooleanValid, toBooleanOrNull } from '../../../helpers/custom-validators/misc'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelDisplayNameValid,
  isVideoChannelSupportValid,
  isVideoChannelUsernameValid
} from '../../../helpers/custom-validators/video-channels'
import { logger } from '../../../helpers/logger'
import { ActorModel } from '../../../models/actor/actor'
import { VideoChannelModel } from '../../../models/video/video-channel'
import { areValidationErrors, doesVideoChannelNameWithHostExist } from '../shared'

const videoChannelsAddValidator = [
  body('name').custom(isVideoChannelUsernameValid).withMessage('Should have a valid channel name'),
  body('displayName').custom(isVideoChannelDisplayNameValid).withMessage('Should have a valid display name'),
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
    if (count >= CONFIG.VIDEO_CHANNELS.MAX_PER_USER) {
      res.fail({ message: `You cannot create more than ${CONFIG.VIDEO_CHANNELS.MAX_PER_USER} channels` })
      return false
    }

    return next()
  }
]

const videoChannelsUpdateValidator = [
  param('nameWithHost').exists().withMessage('Should have an video channel name with host'),
  body('displayName')
    .optional()
    .custom(isVideoChannelDisplayNameValid).withMessage('Should have a valid display name'),
  body('description')
    .optional()
    .custom(isVideoChannelDescriptionValid).withMessage('Should have a valid description'),
  body('support')
    .optional()
    .custom(isVideoChannelSupportValid).withMessage('Should have a valid support text'),
  body('bulkVideosSupportUpdate')
    .optional()
    .custom(isBooleanValid).withMessage('Should have a valid bulkVideosSupportUpdate boolean field'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    return next()
  }
]

const videoChannelsRemoveValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsRemove parameters', { parameters: req.params })

    if (!await checkVideoChannelIsNotTheLastOne(res.locals.videoChannel, res)) return

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

const ensureIsLocalChannel = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.locals.videoChannel.Actor.isOwned() === false) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'This channel is not owned.'
      })
    }

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
  ensureIsLocalChannel,
  videoChannelsListValidator,
  videoChannelStatsValidator
}

// ---------------------------------------------------------------------------

async function checkVideoChannelIsNotTheLastOne (videoChannel: MChannelAccountDefault, res: express.Response) {
  const count = await VideoChannelModel.countByAccount(videoChannel.Account.id)

  if (count <= 1) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Cannot remove the last channel of this user'
    })
    return false
  }

  return true
}
