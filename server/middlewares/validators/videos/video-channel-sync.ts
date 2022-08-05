import * as express from 'express'
import { isUrlValid } from "@server/helpers/custom-validators/activitypub/misc"
import { logger } from "@server/helpers/logger"
import { body, param } from "express-validator"
import { areValidationErrors, doesVideoChannelIdExist } from "../shared"
import { HttpStatusCode, VideoChannelSyncCreate } from '@shared/models'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { CONFIG } from '@server/initializers/config'

export const ensureSyncIsEnabled = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!CONFIG.IMPORT.SYNCHRONIZATION.ENABLED) {
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Synchronization is impossible as video channel synchronization is not enabled on the server'
    })
  }
  return next()
}

export const videoChannelSyncValidator = [
  body('externalChannelUrl').custom(isUrlValid).withMessage('Should have a valid channel url'),
  body('videoChannelId').isInt().withMessage('Should have a valid video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelSync parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const body: VideoChannelSyncCreate = req.body
    if (!await doesVideoChannelIdExist(body.videoChannelId, res)) {
      return
    }

    return next()
  }
]

export const ensureSyncExists = [
  param('id').exists().isInt().withMessage('Should have an sync id'),
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    const syncId = parseInt(req.params.id, 10)
    const sync = await VideoChannelSyncModel.loadWithAccount(syncId)
    if (!sync) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Synchronization not found'
      })
    }
    res.locals.videoChannelSync = sync
    res.locals.videoChannel = sync.VideoChannel
    return next()
  }
]
