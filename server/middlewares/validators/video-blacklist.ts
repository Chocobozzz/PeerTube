import * as express from 'express'
import { param } from 'express-validator/check'
import { isIdOrUUIDValid, logger } from '../../helpers'
import { isVideoExist } from '../../helpers/custom-validators/videos'
import { database as db } from '../../initializers/database'
import { VideoInstance } from '../../models/video/video-interface'
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

function checkVideoIsBlacklistable (video: VideoInstance, res: express.Response) {
  if (video.isOwned() === true) {
    res.status(403)
              .json({ error: 'Cannot blacklist a local video' })
              .end()

    return false
  }

  return true
}

async function checkVideoIsBlacklisted (video: VideoInstance, res: express.Response) {
  const blacklistedVideo = await db.BlacklistedVideo.loadByVideoId(video.id)
  if (!blacklistedVideo) {
    res.status(404)
      .send('Blacklisted video not found')

    return false
  }

  res.locals.blacklistedVideo = blacklistedVideo
  return true
}
