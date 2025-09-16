import { HttpStatusCode, VideoChannelSyncCreate } from '@peertube/peertube-models'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync.js'
import * as express from 'express'
import { body, param, query } from 'express-validator'
import { areValidationErrors, doesChannelIdExist } from '../shared/index.js'
import { doesVideoChannelSyncIdExist } from '../shared/video-channel-syncs.js'

export const ensureSyncIsEnabled = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.ENABLED) {
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Synchronization is impossible as video channel synchronization is not enabled on the server'
    })
  }

  return next()
}

export const videoChannelSyncValidator = [
  body('externalChannelUrl')
    .custom(isUrlValid),

  body('videoChannelId')
    .isInt(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const body: VideoChannelSyncCreate = req.body
    if (!await doesChannelIdExist({ id: body.videoChannelId, checkCanManage: true, checkIsOwner: false, checkIsLocal: true, req, res })) {
      return
    }

    const count = await VideoChannelSyncModel.countByAccount(res.locals.videoChannel.accountId)
    if (count >= CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.MAX_PER_USER) {
      return res.fail({
        message: `You cannot create more than ${CONFIG.IMPORT.VIDEO_CHANNEL_SYNCHRONIZATION.MAX_PER_USER} channel synchronizations`
      })
    }

    return next()
  }
]

export const ensureSyncExists = [
  param('id').exists().isInt().withMessage('Should have an sync id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoChannelSyncIdExist(+req.params.id, res)) return
    if (
      !await doesChannelIdExist({
        id: res.locals.videoChannelSync.videoChannelId,
        checkCanManage: true,
        checkIsOwner: false,
        checkIsLocal: true,
        req,
        res
      })
    ) {
      return
    }

    return next()
  }
]

export const listAccountChannelsSyncValidator = [
  query('includeCollaborations')
    .optional()
    .customSanitizer(toBooleanOrNull),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]
