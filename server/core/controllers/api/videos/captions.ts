import { HttpStatusCode, VideoCaptionGenerate, VideoChannelActivityAction } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { createLocalCaption, createTranscriptionTaskIfNeeded, updateHLSMasterOnCaptionChangeIfNeeded } from '@server/lib/video-captions.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import express from 'express'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { MIMETYPES } from '../../../initializers/constants.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { federateVideoIfNeeded } from '../../../lib/activitypub/videos/index.js'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate } from '../../../middlewares/index.js'
import {
  addVideoCaptionValidator,
  deleteVideoCaptionValidator,
  generateVideoCaptionValidator,
  listVideoCaptionsValidator
} from '../../../middlewares/validators/index.js'
import { VideoCaptionModel } from '../../../models/video/video-caption.js'
import { VideoChannelActivityModel } from '@server/models/video/video-channel-activity.js'

const lTags = loggerTagsFactory('api', 'video-caption')

const reqVideoCaptionAdd = createReqFiles([ 'captionfile' ], MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT)

const videoCaptionsRouter = express.Router()

videoCaptionsRouter.post(
  '/:videoId/captions/generate',
  authenticate,
  asyncMiddleware(generateVideoCaptionValidator),
  asyncMiddleware(createGenerateVideoCaption)
)

videoCaptionsRouter.get('/:videoId/captions', asyncMiddleware(listVideoCaptionsValidator), asyncMiddleware(listVideoCaptions))

videoCaptionsRouter.put(
  '/:videoId/captions/:captionLanguage',
  authenticate,
  reqVideoCaptionAdd,
  asyncMiddleware(addVideoCaptionValidator),
  asyncMiddleware(createVideoCaption)
)

videoCaptionsRouter.delete(
  '/:videoId/captions/:captionLanguage',
  authenticate,
  asyncMiddleware(deleteVideoCaptionValidator),
  asyncRetryTransactionMiddleware(deleteVideoCaption)
)

// ---------------------------------------------------------------------------

export {
  videoCaptionsRouter
}

// ---------------------------------------------------------------------------

async function createGenerateVideoCaption (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const body = req.body as VideoCaptionGenerate
  if (body.forceTranscription === true) {
    await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingTranscription')
  }

  await createTranscriptionTaskIfNeeded(video)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listVideoCaptions (req: express.Request, res: express.Response) {
  const data = await VideoCaptionModel.listVideoCaptions(res.locals.onlyVideo.id)

  return res.json(getFormattedObjects(data, data.length))
}

async function createVideoCaption (req: express.Request, res: express.Response) {
  const videoCaptionPhysicalFile: Express.Multer.File = req.files['captionfile'][0]
  const video = res.locals.videoAll

  const captionLanguage = req.params.captionLanguage

  const videoCaption = await createLocalCaption({
    video,
    language: captionLanguage,
    path: videoCaptionPhysicalFile.path,
    automaticallyGenerated: false
  })

  if (videoCaption.m3u8Filename) {
    await updateHLSMasterOnCaptionChangeIfNeeded(video)
  }

  await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      await VideoChannelActivityModel.addVideoActivity({
        action: VideoChannelActivityAction.UPDATE_CAPTIONS,
        user: res.locals.oauth.token.User,
        channel: video.VideoChannel,
        video,
        transaction: t
      })

      return federateVideoIfNeeded(video, false, t)
    })
  })

  Hooks.runAction('action:api.video-caption.created', { caption: videoCaption, req, res })

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function deleteVideoCaption (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const videoCaption = res.locals.videoCaption
  const hasM3U8 = !!videoCaption.m3u8Filename

  await sequelizeTypescript.transaction(async t => {
    await videoCaption.destroy({ transaction: t })
  })

  if (hasM3U8) {
    await updateHLSMasterOnCaptionChangeIfNeeded(video)
  }

  await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      await VideoChannelActivityModel.addVideoActivity({
        action: VideoChannelActivityAction.UPDATE_CAPTIONS,
        user: res.locals.oauth.token.User,
        channel: video.VideoChannel,
        video,
        transaction: t
      })

      return federateVideoIfNeeded(video, false, t)
    })
  })

  logger.info('Video caption %s of video %s deleted.', videoCaption.language, video.uuid, lTags(video.uuid))

  Hooks.runAction('action:api.video-caption.deleted', { caption: videoCaption, req, res })

  return res.type('json').status(HttpStatusCode.NO_CONTENT_204).end()
}
