import * as express from 'express'
import { param } from 'express-validator/check'
import { isIdOrUUIDValid } from '../../helpers/custom-validators/misc'
import { isVideoExist } from '../../helpers/custom-validators/videos'
import { logger } from '../../helpers/logger'
import { VideoModel } from '../../models/video/video'
import { VideoBlacklistModel } from '../../models/video/video-blacklist'
import { areValidationErrors } from './utils'

const videosBlacklistRemoveValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking blacklistRemove parameters.', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!await checkVideoIsBlacklisted(res.locals.video, res)) return

    return next()
  }
]

const videosBlacklistAddValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosBlacklist parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return
    if (!checkVideoIsBlacklistable(res.locals.video, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosBlacklistAddValidator,
  videosBlacklistRemoveValidator
}
// ---------------------------------------------------------------------------

function checkVideoIsBlacklistable (video: VideoModel, res: express.Response) {
  if (video.isOwned() === true) {
    res.status(403)
              .json({ error: 'Cannot blacklist a local video' })
              .end()

    return false
  }

  return true
}

async function checkVideoIsBlacklisted (video: VideoModel, res: express.Response) {
  const blacklistedVideo = await VideoBlacklistModel.loadByVideoId(video.id)
  if (!blacklistedVideo) {
    res.status(404)
      .send('Blacklisted video not found')

    return false
  }

  res.locals.blacklistedVideo = blacklistedVideo
  return true
}
