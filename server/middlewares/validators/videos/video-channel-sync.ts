import * as express from 'express'
import { isUrlValid } from "@server/helpers/custom-validators/activitypub/misc"
import { logger } from "@server/helpers/logger"
import { body, param } from "express-validator"
import { areValidationErrors, doesVideoChannelIdExist } from "../shared"
import { HttpStatusCode, VideoChannelSyncCreate } from '@shared/models'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { ServerConfigManager } from '@server/lib/server-config-manager'

export const ensureSyncIsEnabled = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const serverConfig = await ServerConfigManager.Instance.getServerConfig()
  if (!serverConfig.import.videos.http.enabled) {
    return res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Synchronization is impossible as video upload via HTTP is not enabled on the server'
    })
  }
  return next()
}

export const videoChannelSyncValidator = [
  body('externalChannelUrl').custom(isUrlValid).withMessage('Should have a valid channel url'),
  body('videoChannel').isInt().withMessage('Should have a valid video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoChannelsAdd parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return

    const body: VideoChannelSyncCreate = req.body
    if (!await doesVideoChannelIdExist(body.videoChannel, res)) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video Channel not found'
      })
    }

    return next()
  }
]

export const ensureSyncExists = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {

    const syncId = parseInt(req.params.id, 10)
    const sync = await VideoChannelSyncModel.loadById(syncId)
    if (!sync) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Synchronization not found'
      })
    }
    res.locals.videoChannelSync = sync
    return next()
  }
]

export const ensureSyncTargetChannelExists = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sync = res.locals.videoChannelSync
    if (!await doesVideoChannelIdExist(sync.videoChannel, res)) {
      return
    }
    await sync.reload({ include: VideoChannelModel })
    return next()
  }
]

const routeWithIdValidator = [
  param('id').exists().isInt().withMessage('Should have an sync id'),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    return next()
  }
]

export const videoChannelSyncRemoveValidator = routeWithIdValidator
export const syncChannelValidator = routeWithIdValidator
