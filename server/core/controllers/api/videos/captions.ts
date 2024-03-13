import express from 'express'
import { HttpStatusCode } from '@peertube/peertube-models'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { logger } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { MIMETYPES } from '../../../initializers/constants.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { federateVideoIfNeeded } from '../../../lib/activitypub/videos/index.js'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate } from '../../../middlewares/index.js'
import { addVideoCaptionValidator, deleteVideoCaptionValidator, listVideoCaptionsValidator } from '../../../middlewares/validators/index.js'
import { VideoCaptionModel } from '../../../models/video/video-caption.js'
import { createLocalCaption } from '@server/lib/video-captions.js'

const reqVideoCaptionAdd = createReqFiles([ 'captionfile' ], MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT)

const videoCaptionsRouter = express.Router()

videoCaptionsRouter.get('/:videoId/captions',
  asyncMiddleware(listVideoCaptionsValidator),
  asyncMiddleware(listVideoCaptions)
)
videoCaptionsRouter.put('/:videoId/captions/:captionLanguage',
  authenticate,
  reqVideoCaptionAdd,
  asyncMiddleware(addVideoCaptionValidator),
  asyncRetryTransactionMiddleware(createVideoCaption)
)
videoCaptionsRouter.delete('/:videoId/captions/:captionLanguage',
  authenticate,
  asyncMiddleware(deleteVideoCaptionValidator),
  asyncRetryTransactionMiddleware(deleteVideoCaption)
)

// ---------------------------------------------------------------------------

export {
  videoCaptionsRouter
}

// ---------------------------------------------------------------------------

async function listVideoCaptions (req: express.Request, res: express.Response) {
  const data = await VideoCaptionModel.listVideoCaptions(res.locals.onlyVideo.id)

  return res.json(getFormattedObjects(data, data.length))
}

async function createVideoCaption (req: express.Request, res: express.Response) {
  const videoCaptionPhysicalFile: Express.Multer.File = req.files['captionfile'][0]
  const video = res.locals.videoAll

  const captionLanguage = req.params.captionLanguage

  const videoCaption = await createLocalCaption({ video, language: captionLanguage, path: videoCaptionPhysicalFile.path })

  await sequelizeTypescript.transaction(async t => {
    await federateVideoIfNeeded(video, false, t)
  })

  Hooks.runAction('action:api.video-caption.created', { caption: videoCaption, req, res })

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function deleteVideoCaption (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const videoCaption = res.locals.videoCaption

  await sequelizeTypescript.transaction(async t => {
    await videoCaption.destroy({ transaction: t })

    // Send video update
    await federateVideoIfNeeded(video, false, t)
  })

  logger.info('Video caption %s of video %s deleted.', videoCaption.language, video.uuid)

  Hooks.runAction('action:api.video-caption.deleted', { caption: videoCaption, req, res })

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
