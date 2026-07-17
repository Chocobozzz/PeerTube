import { HttpStatusCode, VideoUpdate } from '@peertube/peertube-models'
import { getVideoThumbnailFile } from '@server/helpers/video.js'
import { LocalVideoUpdater } from '@server/lib/local-video-updater.js'
import { createLocalVideoThumbnailsFromImage } from '@server/lib/thumbnail.js'
import { openapiOperationDoc } from '@server/middlewares/doc.js'
import { MVideoThumbnails } from '@server/types/models/index.js'
import express from 'express'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { loggerTagsFactory } from '../../../helpers/logger.js'
import { MIMETYPES } from '../../../initializers/constants.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videosUpdateValidator } from '../../../middlewares/index.js'

const lTags = loggerTagsFactory('api', 'video')
const updateRouter = express.Router()

const reqVideoFileUpdate = createReqFiles([ 'thumbnailfile', 'previewfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)

updateRouter.put(
  '/:id',
  openapiOperationDoc({ operationId: 'putVideo' }),
  authenticate,
  reqVideoFileUpdate,
  asyncMiddleware(videosUpdateValidator),
  asyncRetryTransactionMiddleware(updateVideo)
)

// ---------------------------------------------------------------------------

export {
  updateRouter
}

// ---------------------------------------------------------------------------

async function updateVideo (req: express.Request, res: express.Response) {
  const videoFromReq = res.locals.videoFull
  const body: VideoUpdate = req.body
  const user = res.locals.oauth.token.User

  const thumbnails = await buildVideoThumbnailsFromReq(videoFromReq, req)

  const localVideoUpdater = new LocalVideoUpdater({ user, lTags, video: videoFromReq })

  const video = await localVideoUpdater.update({ ...body, thumbnails })

  Hooks.runAction('action:api.video.updated', { video, body: req.body, req, res })

  return res.type('json')
    .status(HttpStatusCode.NO_CONTENT_204)
    .end()
}

async function buildVideoThumbnailsFromReq (video: MVideoThumbnails, req: express.Request) {
  const file = getVideoThumbnailFile(req.files)
  if (!file) return []

  return createLocalVideoThumbnailsFromImage({
    inputPath: file.path,
    video,
    automaticallyGenerated: false
  })
}
