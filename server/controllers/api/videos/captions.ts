import * as express from 'express'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate } from '../../../middlewares'
import {
  addVideoCaptionValidator,
  deleteVideoCaptionValidator,
  listVideoCaptionsValidator
} from '../../../middlewares/validators/video-captions'
import { createReqFiles } from '../../../helpers/express-utils'
import { CONFIG, sequelizeTypescript, VIDEO_CAPTIONS_MIMETYPE_EXT } from '../../../initializers'
import { getFormattedObjects } from '../../../helpers/utils'
import { VideoCaptionModel } from '../../../models/video/video-caption'
import { VideoModel } from '../../../models/video/video'
import { logger } from '../../../helpers/logger'
import { federateVideoIfNeeded } from '../../../lib/activitypub'
import { moveAndProcessCaptionFile } from '../../../helpers/captions-utils'

const reqVideoCaptionAdd = createReqFiles(
  [ 'captionfile' ],
  VIDEO_CAPTIONS_MIMETYPE_EXT,
  {
    captionfile: CONFIG.STORAGE.CAPTIONS_DIR
  }
)

const videoCaptionsRouter = express.Router()

videoCaptionsRouter.get('/:videoId/captions',
  asyncMiddleware(listVideoCaptionsValidator),
  asyncMiddleware(listVideoCaptions)
)
videoCaptionsRouter.put('/:videoId/captions/:captionLanguage',
  authenticate,
  reqVideoCaptionAdd,
  asyncMiddleware(addVideoCaptionValidator),
  asyncRetryTransactionMiddleware(addVideoCaption)
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
  const data = await VideoCaptionModel.listVideoCaptions(res.locals.video.id)

  return res.json(getFormattedObjects(data, data.length))
}

async function addVideoCaption (req: express.Request, res: express.Response) {
  const videoCaptionPhysicalFile = req.files['captionfile'][0]
  const video = res.locals.video as VideoModel

  const videoCaption = new VideoCaptionModel({
    videoId: video.id,
    language: req.params.captionLanguage
  })
  videoCaption.Video = video

  // Move physical file
  await moveAndProcessCaptionFile(videoCaptionPhysicalFile, videoCaption)

  await sequelizeTypescript.transaction(async t => {
    await VideoCaptionModel.insertOrReplaceLanguage(video.id, req.params.captionLanguage, t)

    // Update video update
    await federateVideoIfNeeded(video, false, t)
  })

  return res.status(204).end()
}

async function deleteVideoCaption (req: express.Request, res: express.Response) {
  const video = res.locals.video as VideoModel
  const videoCaption = res.locals.videoCaption as VideoCaptionModel

  await sequelizeTypescript.transaction(async t => {
    await videoCaption.destroy({ transaction: t })

    // Send video update
    await federateVideoIfNeeded(video, false, t)
  })

  logger.info('Video caption %s of video %s deleted.', videoCaption.language, video.uuid)

  return res.type('json').status(204).end()
}
