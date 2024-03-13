import express from 'express'
import {
  HttpStatusCode,
  LiveVideoCreate,
  LiveVideoUpdate,
  ThumbnailType,
  UserRight,
  VideoState
} from '@peertube/peertube-models'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { createReqFiles } from '@server/helpers/express-utils.js'
import { getFormattedObjects } from '@server/helpers/utils.js'
import { ASSETS_PATH, MIMETYPES } from '@server/initializers/constants.js'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos/index.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import {
  videoLiveAddValidator,
  videoLiveFindReplaySessionValidator,
  videoLiveGetValidator,
  videoLiveListSessionsValidator,
  videoLiveUpdateValidator
} from '@server/middlewares/validators/videos/video-live.js'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting.js'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session.js'
import { MVideoLive } from '@server/types/models/index.js'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { logger, loggerTagsFactory } from '../../../helpers/logger.js'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, optionalAuthenticate } from '../../../middlewares/index.js'
import { LocalVideoCreator } from '@server/lib/local-video-creator.js'
import { pick } from '@peertube/peertube-core-utils'

const lTags = loggerTagsFactory('api', 'live')

const liveRouter = express.Router()

const reqVideoFileLive = createReqFiles([ 'thumbnailfile', 'previewfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)

liveRouter.post('/live',
  authenticate,
  reqVideoFileLive,
  asyncMiddleware(videoLiveAddValidator),
  asyncRetryTransactionMiddleware(addLiveVideo)
)

liveRouter.get('/live/:videoId/sessions',
  authenticate,
  asyncMiddleware(videoLiveGetValidator),
  videoLiveListSessionsValidator,
  asyncMiddleware(getLiveVideoSessions)
)

liveRouter.get('/live/:videoId',
  optionalAuthenticate,
  asyncMiddleware(videoLiveGetValidator),
  getLiveVideo
)

liveRouter.put('/live/:videoId',
  authenticate,
  asyncMiddleware(videoLiveGetValidator),
  videoLiveUpdateValidator,
  asyncRetryTransactionMiddleware(updateLiveVideo)
)

liveRouter.get('/:videoId/live-session',
  asyncMiddleware(videoLiveFindReplaySessionValidator),
  getLiveReplaySession
)

// ---------------------------------------------------------------------------

export {
  liveRouter
}

// ---------------------------------------------------------------------------

function getLiveVideo (req: express.Request, res: express.Response) {
  const videoLive = res.locals.videoLive

  return res.json(videoLive.toFormattedJSON(canSeePrivateLiveInformation(res)))
}

function getLiveReplaySession (req: express.Request, res: express.Response) {
  const session = res.locals.videoLiveSession

  return res.json(session.toFormattedJSON())
}

async function getLiveVideoSessions (req: express.Request, res: express.Response) {
  const videoLive = res.locals.videoLive

  const data = await VideoLiveSessionModel.listSessionsOfLiveForAPI({ videoId: videoLive.videoId })

  return res.json(getFormattedObjects(data, data.length))
}

function canSeePrivateLiveInformation (res: express.Response) {
  const user = res.locals.oauth?.token.User
  if (!user) return false

  if (user.hasRight(UserRight.GET_ANY_LIVE)) return true

  const video = res.locals.videoAll
  return video.VideoChannel.Account.userId === user.id
}

async function updateLiveVideo (req: express.Request, res: express.Response) {
  const body: LiveVideoUpdate = req.body

  const video = res.locals.videoAll
  const videoLive = res.locals.videoLive

  const newReplaySettingModel = await updateReplaySettings(videoLive, body)
  if (newReplaySettingModel) videoLive.replaySettingId = newReplaySettingModel.id
  else videoLive.replaySettingId = null

  if (exists(body.permanentLive)) videoLive.permanentLive = body.permanentLive
  if (exists(body.latencyMode)) videoLive.latencyMode = body.latencyMode

  video.VideoLive = await videoLive.save()

  await federateVideoIfNeeded(video, false)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function updateReplaySettings (videoLive: MVideoLive, body: LiveVideoUpdate) {
  if (exists(body.saveReplay)) videoLive.saveReplay = body.saveReplay

  // The live replay is not saved anymore, destroy the old model if it existed
  if (!videoLive.saveReplay) {
    if (videoLive.replaySettingId) {
      await VideoLiveReplaySettingModel.removeSettings(videoLive.replaySettingId)
    }

    return undefined
  }

  const settingModel = videoLive.replaySettingId
    ? await VideoLiveReplaySettingModel.load(videoLive.replaySettingId)
    : new VideoLiveReplaySettingModel()

  if (exists(body.replaySettings.privacy)) settingModel.privacy = body.replaySettings.privacy

  return settingModel.save()
}

async function addLiveVideo (req: express.Request, res: express.Response) {
  const videoInfo: LiveVideoCreate = req.body

  const thumbnails = [ { type: ThumbnailType.MINIATURE, field: 'thumbnailfile' }, { type: ThumbnailType.PREVIEW, field: 'previewfile' } ]
    .map(({ type, field }) => {
      if (req.files?.[field]?.[0]) {
        return {
          path: req.files[field][0].path,
          type,
          automaticallyGenerated: false,
          keepOriginal: false
        }
      }

      return {
        path: ASSETS_PATH.DEFAULT_LIVE_BACKGROUND,
        type,
        automaticallyGenerated: true,
        keepOriginal: true
      }
    })

  const localVideoCreator = new LocalVideoCreator({
    channel: res.locals.videoChannel,
    chapters: undefined,
    fallbackChapters: {
      fromDescription: false,
      finalFallback: undefined
    },
    liveAttributes: pick(videoInfo, [ 'saveReplay', 'permanentLive', 'latencyMode', 'replaySettings' ]),
    videoAttributeResultHook: 'filter:api.video.live.video-attribute.result',
    lTags,
    videoAttributes: {
      ...videoInfo,

      duration: 0,
      state: VideoState.WAITING_FOR_LIVE,
      isLive: true,
      inputFilename: null
    },
    videoFile: undefined,
    user: res.locals.oauth.token.User,
    thumbnails
  })

  const { video } = await localVideoCreator.create()

  logger.info('Video live %s with uuid %s created.', videoInfo.name, video.uuid, lTags())

  Hooks.runAction('action:api.live-video.created', { video, req, res })

  return res.json({
    video: {
      id: video.id,
      shortUUID: uuidToShort(video.uuid),
      uuid: video.uuid
    }
  })
}
