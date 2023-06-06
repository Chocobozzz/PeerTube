import express from 'express'
import { exists } from '@server/helpers/custom-validators/misc'
import { createReqFiles } from '@server/helpers/express-utils'
import { getFormattedObjects } from '@server/helpers/utils'
import { ASSETS_PATH, MIMETYPES } from '@server/initializers/constants'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { Hooks } from '@server/lib/plugins/hooks'
import { buildLocalVideoFromReq, buildVideoThumbnailsFromReq, setVideoTags } from '@server/lib/video'
import {
  videoLiveAddValidator,
  videoLiveFindReplaySessionValidator,
  videoLiveGetValidator,
  videoLiveListSessionsValidator,
  videoLiveUpdateValidator
} from '@server/middlewares/validators/videos/video-live'
import { VideoLiveModel } from '@server/models/video/video-live'
import { VideoLiveSessionModel } from '@server/models/video/video-live-session'
import { MVideoDetails, MVideoFullLight, MVideoLive } from '@server/types/models'
import { buildUUID, uuidToShort } from '@shared/extra-utils'
import { HttpStatusCode, LiveVideoCreate, LiveVideoLatencyMode, LiveVideoUpdate, UserRight, VideoPrivacy, VideoState } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { updateLocalVideoMiniatureFromExisting } from '../../../lib/thumbnail'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, optionalAuthenticate } from '../../../middlewares'
import { VideoModel } from '../../../models/video/video'
import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting'
import { VideoPasswordModel } from '@server/models/video/video-password'

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

  // Prepare data so we don't block the transaction
  let videoData = buildLocalVideoFromReq(videoInfo, res.locals.videoChannel.id)
  videoData = await Hooks.wrapObject(videoData, 'filter:api.video.live.video-attribute.result')

  videoData.isLive = true
  videoData.state = VideoState.WAITING_FOR_LIVE
  videoData.duration = 0

  const video = new VideoModel(videoData) as MVideoDetails
  video.url = getLocalVideoActivityPubUrl(video) // We use the UUID, so set the URL after building the object

  const videoLive = new VideoLiveModel()
  videoLive.saveReplay = videoInfo.saveReplay || false
  videoLive.permanentLive = videoInfo.permanentLive || false
  videoLive.latencyMode = videoInfo.latencyMode || LiveVideoLatencyMode.DEFAULT
  videoLive.streamKey = buildUUID()

  const [ thumbnailModel, previewModel ] = await buildVideoThumbnailsFromReq({
    video,
    files: req.files,
    fallback: type => {
      return updateLocalVideoMiniatureFromExisting({
        inputPath: ASSETS_PATH.DEFAULT_LIVE_BACKGROUND,
        video,
        type,
        automaticallyGenerated: true,
        keepOriginal: true
      })
    }
  })

  const { videoCreated } = await sequelizeTypescript.transaction(async t => {
    const sequelizeOptions = { transaction: t }

    const videoCreated = await video.save(sequelizeOptions) as MVideoFullLight

    if (thumbnailModel) await videoCreated.addAndSaveThumbnail(thumbnailModel, t)
    if (previewModel) await videoCreated.addAndSaveThumbnail(previewModel, t)

    // Do not forget to add video channel information to the created video
    videoCreated.VideoChannel = res.locals.videoChannel

    if (videoLive.saveReplay) {
      const replaySettings = new VideoLiveReplaySettingModel({
        privacy: videoInfo.replaySettings.privacy
      })
      await replaySettings.save(sequelizeOptions)

      videoLive.replaySettingId = replaySettings.id
    }

    videoLive.videoId = videoCreated.id
    videoCreated.VideoLive = await videoLive.save(sequelizeOptions)

    await setVideoTags({ video, tags: videoInfo.tags, transaction: t })

    await federateVideoIfNeeded(videoCreated, true, t)

    if (videoInfo.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
      await VideoPasswordModel.addPasswords(videoInfo.videoPasswords, video.id, t)
    }

    logger.info('Video live %s with uuid %s created.', videoInfo.name, videoCreated.uuid)

    return { videoCreated }
  })

  Hooks.runAction('action:api.live-video.created', { video: videoCreated, req, res })

  return res.json({
    video: {
      id: videoCreated.id,
      shortUUID: uuidToShort(videoCreated.uuid),
      uuid: videoCreated.uuid
    }
  })
}
