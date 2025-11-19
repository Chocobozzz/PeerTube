import { HttpStatusCode, VideosImportInChannelCreate } from '@peertube/peertube-models'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { loadReservedActorName } from '@server/lib/local-actor.js'
import { MChannelAccountDefault } from '@server/types/models/index.js'
import express from 'express'
import { body, param, query } from 'express-validator'
import { isBooleanValid, isIdValid, toBooleanOrNull } from '../../../helpers/custom-validators/misc.js'
import {
  isVideoChannelDescriptionValid,
  isVideoChannelDisplayNameValid,
  isVideoChannelSupportValid,
  isVideoChannelUsernameValid
} from '../../../helpers/custom-validators/video-channels.js'
import { VideoChannelModel } from '../../../models/video/video-channel.js'
import { areValidationErrors, checkUserQuota, doesChannelHandleExist } from '../shared/index.js'
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

    const actor = await loadReservedActorName(req.body.name)
    if (actor) {
      res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t(
          'Another actor (account/channel) with name {name} on this instance already exists or has already existed.',
          { name: req.body.name }
        )
      })
      return false
    }

    const count = await VideoChannelModel.countByAccount(res.locals.oauth.token.User.Account.id)
    if (count >= CONFIG.VIDEO_CHANNELS.MAX_PER_USER) {
      res.fail({ message: req.t('You cannot create more than {count} channels', { count: CONFIG.VIDEO_CHANNELS.MAX_PER_USER }) })
      return false
    }

    return next()
  }
]

export const videoChannelsUpdateValidator = [
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
    if (!await checkVideoChannelIsNotTheLastOne(res.locals.videoChannel, req, res)) return

    return next()
  }
]

export const videoChannelsHandleValidatorFactory = (options: {
  checkIsLocal: boolean
  checkCanManage: boolean
  checkIsOwner: boolean
}) => {
  const { checkIsLocal, checkCanManage, checkIsOwner } = options

  return [
    param('handle')
      .exists(),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      if (!await doesChannelHandleExist({ handle: req.params.handle, checkCanManage, checkIsLocal, checkIsOwner, req, res })) return

      return next()
    }
  ]
}

export const listAccountChannelsValidator = [
  query('withStats')
    .optional()
    .customSanitizer(toBooleanOrNull),

  query('includeCollaborations')
    .optional()
    .customSanitizer(toBooleanOrNull),

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
        message: req.t('Channel import is impossible as video upload via HTTP is not enabled on the server')
      })
    }

    if (body.videoChannelSyncId && !await doesVideoChannelSyncIdExist(body.videoChannelSyncId, res)) return

    if (res.locals.videoChannelSync && res.locals.videoChannelSync.videoChannelId !== res.locals.videoChannel.id) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: req.t('This channel sync is not owned by this channel')
      })
    }

    const user = { id: res.locals.videoChannel.Account.userId }
    if (!await checkUserQuota({ user, videoFileSize: 1, req, res })) return

    return next()
  }
]

// ---------------------------------------------------------------------------

async function checkVideoChannelIsNotTheLastOne (videoChannel: MChannelAccountDefault, req: express.Request, res: express.Response) {
  const count = await VideoChannelModel.countByAccount(videoChannel.Account.id)

  if (count <= 1) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: req.t('Cannot remove the last channel of this user')
    })
    return false
  }

  return true
}
