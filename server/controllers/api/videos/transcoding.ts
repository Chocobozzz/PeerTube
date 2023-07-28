import express from 'express'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { Hooks } from '@server/lib/plugins/hooks'
import { createTranscodingJobs } from '@server/lib/transcoding/create-transcoding-job'
import { computeResolutionsToTranscode } from '@server/lib/transcoding/transcoding-resolutions'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { HttpStatusCode, UserRight, VideoState, VideoTranscodingCreate } from '@shared/models'
import { asyncMiddleware, authenticate, createTranscodingValidator, ensureUserHasRight } from '../../../middlewares'

const lTags = loggerTagsFactory('api', 'video')
const transcodingRouter = express.Router()

transcodingRouter.post('/:videoId/transcoding',
  authenticate,
  ensureUserHasRight(UserRight.RUN_VIDEO_TRANSCODING),
  asyncMiddleware(createTranscodingValidator),
  asyncMiddleware(createTranscoding)
)

// ---------------------------------------------------------------------------

export {
  transcodingRouter
}

// ---------------------------------------------------------------------------

async function createTranscoding (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  logger.info('Creating %s transcoding job for %s.', req.body.transcodingType, video.url, lTags())

  const body: VideoTranscodingCreate = req.body

  await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingTranscode')

  const { resolution: maxResolution, hasAudio } = await video.probeMaxQualityFile()

  const resolutions = await Hooks.wrapObject(
    computeResolutionsToTranscode({ input: maxResolution, type: 'vod', includeInput: true, strictLower: false, hasAudio }),
    'filter:transcoding.manual.resolutions-to-transcode.result',
    body
  )

  if (resolutions.length === 0) {
    return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
  }

  video.state = VideoState.TO_TRANSCODE
  await video.save()

  await createTranscodingJobs({
    video,
    resolutions,
    transcodingType: body.transcodingType,
    isNewVideo: false,
    user: null // Don't specify priority since these transcoding jobs are fired by the admin
  })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
