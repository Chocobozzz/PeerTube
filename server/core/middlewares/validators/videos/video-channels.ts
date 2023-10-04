import express from 'express'
import { body, param, query } from 'express-validator'
import { HttpStatusCode, VideosImportInChannelCreate } from '@peertube/peertube-models'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { MChannelAccountDefault } from '@server/types/models/index.js'
import { isBooleanValid, isIdValid, toBooleanOrNull } from '../../../helpers/custom-validators/misc.js'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelDisplayNameValid,
  isVideoChannelSupportValid,
  isVideoChannelUsernameValid
} from '../../../helpers/custom-validators/video-channels.js'
import { ActorModel } from '../../../models/actor/actor.js'
import { VideoChannelModel } from '../../../models/video/video-channel.js'
import { areValidationErrors, checkUserQuota, doesVideoChannelNameWithHostExist } from '../shared/index.js'
import { doesVideoChannelSyncIdExist } from '../shared/video-channel-syncs.js'

export const videoChannelsAddValidator = [
  body('name')
    .custom(isVideoChannelUsernameValid),
  body('displayName')
    .custom(isVideoChannelDisplayNameValid),
  body('description')
    .optional()
    .custom(isVideoChannelDescriptionValid),
  body('support')
    .optional()
    .custom(isVideoChannelSupportValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export const videoChannelsUpdateValidator = [
  param('nameWithHost')
    .exists(),

  body('displayName')
    .optional()
    .custom(isVideoChannelDisplayNameValid),
  body('description')
    .optional()
    .custom(isVideoChannelDescriptionValid),
  body('support')
    .optional()
    .custom(isVideoChannelSupportValid),
  body('bulkVideosSupportUpdate')
    .optional()
    .custom(isBooleanValid).withMessage('Should have a valid bulkVideosSupportUpdate boolean field'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const videoChannelsRemoveValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!await checkVideoChannelIsNotTheLastOne(res.locals.videoChannel, res)) return

    return next()
  }
]

export const videoChannelsNameWithHostValidator = [
  param('nameWithHost')
    .exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoChannelNameWithHostExist(req.params.nameWithHost, res)) return

    return next()
  }
]

export const ensureIsLocalChannel = [
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

export const ensureChannelOwnerCanUpload = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const channel = res.locals.videoChannel
    const user = { id: channel.Account.userId }

    if (!await checkUserQuota(user, 1, res)) return

    next()
  }
]

export const videoChannelStatsValidator = [
  query('withStats')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid stats flag boolean'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    return next()
  }
]

export const videoChannelsListValidator = [
  query('search')
    .optional()
    .not().isEmpty(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const videoChannelImportVideosValidator = [
  body('externalChannelUrl')
    .custom(isUrlValid),

  body('videoChannelSyncId')
    .optional()
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const body: VideosImportInChannelCreate = req.body

    if (!CONFIG.IMPORT.VIDEOS.HTTP.ENABLED) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Channel import is impossible as video upload via HTTP is not enabled on the server'
      })
    }

    if (body.videoChannelSyncId && !await doesVideoChannelSyncIdExist(body.videoChannelSyncId, res)) return

    if (res.locals.videoChannelSync && res.locals.videoChannelSync.videoChannelId !== res.locals.videoChannel.id) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'This channel sync is not owned by this channel'
      })
    }

    return next()
  }
]

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
