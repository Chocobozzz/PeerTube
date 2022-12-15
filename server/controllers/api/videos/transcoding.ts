import Bluebird from 'bluebird'
import express from 'express'
import { computeResolutionsToTranscode } from '@server/helpers/ffmpeg'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { JobQueue } from '@server/lib/job-queue'
import { Hooks } from '@server/lib/plugins/hooks'
import { buildTranscodingJob } from '@server/lib/video'
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

  const childrenResolutions = resolutions.filter(r => r !== maxResolution)

  logger.info('Manually creating transcoding jobs for %s.', body.transcodingType, { childrenResolutions, maxResolution })

  const children = await Bluebird.mapSeries(childrenResolutions, resolution => {
    if (body.transcodingType === 'hls') {
      return buildHLSJobOption({
        videoUUID: video.uuid,
        hasAudio,
        resolution,
        isMaxQuality: false
      })
    }

    if (body.transcodingType === 'webtorrent') {
      return buildWebTorrentJobOption({
        videoUUID: video.uuid,
        hasAudio,
        resolution
      })
    }
  })

  const parent = body.transcodingType === 'hls'
    ? await buildHLSJobOption({
      videoUUID: video.uuid,
      hasAudio,
      resolution: maxResolution,
      isMaxQuality: false
    })
    : await buildWebTorrentJobOption({
      videoUUID: video.uuid,
      hasAudio,
      resolution: maxResolution
    })

  // Porcess the last resolution after the other ones to prevent concurrency issue
  // Because low resolutions use the biggest one as ffmpeg input
  await JobQueue.Instance.createJobWithChildren(parent, children)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

function buildHLSJobOption (options: {
  videoUUID: string
  hasAudio: boolean
  resolution: number
  isMaxQuality: boolean
}) {
  const { videoUUID, hasAudio, resolution, isMaxQuality } = options

  return buildTranscodingJob({
    type: 'new-resolution-to-hls',
    videoUUID,
    resolution,
    hasAudio,
    copyCodecs: false,
    isNewVideo: false,
    autoDeleteWebTorrentIfNeeded: false,
    isMaxQuality
  })
}

function buildWebTorrentJobOption (options: {
  videoUUID: string
  hasAudio: boolean
  resolution: number
}) {
  const { videoUUID, hasAudio, resolution } = options

  return buildTranscodingJob({
    type: 'new-resolution-to-webtorrent',
    videoUUID,
    isNewVideo: false,
    resolution,
    hasAudio,
    createHLSIfNeeded: false
  })
}
