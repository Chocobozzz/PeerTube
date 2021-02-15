import * as express from 'express'
import { MVideoCaption } from '@server/types/models'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import { moveAndProcessCaptionFile } from '../../../helpers/captions-utils'
import { createReqFiles } from '../../../helpers/express-utils'
import { logger } from '../../../helpers/logger'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG } from '../../../initializers/config'
import { MIMETYPES } from '../../../initializers/constants'
import { sequelizeTypescript } from '../../../initializers/database'
import { federateVideoIfNeeded } from '../../../lib/activitypub/videos'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate } from '../../../middlewares'
import { addVideoCaptionValidator, deleteVideoCaptionValidator, listVideoCaptionsValidator } from '../../../middlewares/validators'
import { VideoCaptionModel } from '../../../models/video/video-caption'

const reqVideoCaptionAdd = createReqFiles(
  [ 'captionfile' ],
  MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT,
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
  const data = await VideoCaptionModel.listVideoCaptions(res.locals.videoId.id)

  return res.json(getFormattedObjects(data, data.length))
}

async function addVideoCaption (req: express.Request, res: express.Response) {
  const videoCaptionPhysicalFile = req.files['captionfile'][0]
  const video = res.locals.videoAll

  const captionLanguage = req.params.captionLanguage

  const videoCaption = new VideoCaptionModel({
    videoId: video.id,
    filename: VideoCaptionModel.generateCaptionName(captionLanguage),
    language: captionLanguage
  }) as MVideoCaption

  // Move physical file
  await moveAndProcessCaptionFile(videoCaptionPhysicalFile, videoCaption)

  await sequelizeTypescript.transaction(async t => {
    await VideoCaptionModel.insertOrReplaceLanguage(videoCaption, t)

    // Update video update
    await federateVideoIfNeeded(video, false, t)
  })

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

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
