import express from 'express'
import { computeLowerResolutionsToTranscode } from '@server/helpers/ffprobe-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { addTranscodingJob } from '@server/lib/video'
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
  logger.info('Creating %s transcoding job for %s.', req.body.type, video.url, lTags())

  const body: VideoTranscodingCreate = req.body

  const { resolution: maxResolution, isPortraitMode, audioStream } = await video.getMaxQualityFileInfo()
  const resolutions = computeLowerResolutionsToTranscode(maxResolution, 'vod').concat([ maxResolution ])

  video.state = VideoState.TO_TRANSCODE
  await video.save()

  for (const resolution of resolutions) {
    if (body.transcodingType === 'hls') {
      await addTranscodingJob({
        type: 'new-resolution-to-hls',
        videoUUID: video.uuid,
        resolution,
        isPortraitMode,
        hasAudio: !!audioStream,
        copyCodecs: false,
        isNewVideo: false,
        autoDeleteWebTorrentIfNeeded: false,
        isMaxQuality: maxResolution === resolution
      })
    } else if (body.transcodingType === 'webtorrent') {
      await addTranscodingJob({
        type: 'new-resolution-to-webtorrent',
        videoUUID: video.uuid,
        isNewVideo: false,
        resolution: resolution,
        hasAudio: !!audioStream,
        isPortraitMode
      })
    }
  }

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
