import * as express from 'express'
import { v4 as uuidv4 } from 'uuid'
import { createReqFiles } from '@server/helpers/express-utils'
import { CONFIG } from '@server/initializers/config'
import { ASSETS_PATH, MIMETYPES } from '@server/initializers/constants'
import { getLocalVideoActivityPubUrl } from '@server/lib/activitypub/url'
import { federateVideoIfNeeded } from '@server/lib/activitypub/videos'
import { Hooks } from '@server/lib/plugins/hooks'
import { buildLocalVideoFromReq, buildVideoThumbnailsFromReq, setVideoTags } from '@server/lib/video'
import { videoLiveAddValidator, videoLiveGetValidator, videoLiveUpdateValidator } from '@server/middlewares/validators/videos/video-live'
import { VideoLiveModel } from '@server/models/video/video-live'
import { MVideoDetails, MVideoFullLight } from '@server/types/models'
import { LiveVideoCreate, LiveVideoUpdate, VideoState } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { sequelizeTypescript } from '../../../initializers/database'
import { createVideoMiniatureFromExisting } from '../../../lib/thumbnail'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate } from '../../../middlewares'
import { VideoModel } from '../../../models/video/video'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const liveRouter = express.Router()

const reqVideoFileLive = createReqFiles(
  [ 'thumbnailfile', 'previewfile' ],
  MIMETYPES.IMAGE.MIMETYPE_EXT,
  {
    thumbnailfile: CONFIG.STORAGE.TMP_DIR,
    previewfile: CONFIG.STORAGE.TMP_DIR
  }
)

liveRouter.post('/live',
  authenticate,
  reqVideoFileLive,
  asyncMiddleware(videoLiveAddValidator),
  asyncRetryTransactionMiddleware(addLiveVideo)
)

liveRouter.get('/live/:videoId',
  authenticate,
  asyncMiddleware(videoLiveGetValidator),
  asyncRetryTransactionMiddleware(getLiveVideo)
)

liveRouter.put('/live/:videoId',
  authenticate,
  asyncMiddleware(videoLiveGetValidator),
  videoLiveUpdateValidator,
  asyncRetryTransactionMiddleware(updateLiveVideo)
)

// ---------------------------------------------------------------------------

export {
  liveRouter
}

// ---------------------------------------------------------------------------

async function getLiveVideo (req: express.Request, res: express.Response) {
  const videoLive = res.locals.videoLive

  return res.json(videoLive.toFormattedJSON())
}

async function updateLiveVideo (req: express.Request, res: express.Response) {
  const body: LiveVideoUpdate = req.body

  const video = res.locals.videoAll
  const videoLive = res.locals.videoLive

  videoLive.saveReplay = body.saveReplay || false
  videoLive.permanentLive = body.permanentLive || false

  video.VideoLive = await videoLive.save()

  await federateVideoIfNeeded(video, false)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function addLiveVideo (req: express.Request, res: express.Response) {
  const videoInfo: LiveVideoCreate = req.body

  // Prepare data so we don't block the transaction
  const videoData = buildLocalVideoFromReq(videoInfo, res.locals.videoChannel.id)
  videoData.isLive = true
  videoData.state = VideoState.WAITING_FOR_LIVE
  videoData.duration = 0

  const video = new VideoModel(videoData) as MVideoDetails
  video.url = getLocalVideoActivityPubUrl(video) // We use the UUID, so set the URL after building the object

  const videoLive = new VideoLiveModel()
  videoLive.saveReplay = videoInfo.saveReplay || false
  videoLive.permanentLive = videoInfo.permanentLive || false
  videoLive.streamKey = uuidv4()

  const [ thumbnailModel, previewModel ] = await buildVideoThumbnailsFromReq({
    video,
    files: req.files,
    fallback: type => {
      return createVideoMiniatureFromExisting({
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

    videoLive.videoId = videoCreated.id
    videoCreated.VideoLive = await videoLive.save(sequelizeOptions)

    await setVideoTags({ video, tags: videoInfo.tags, transaction: t })

    await federateVideoIfNeeded(videoCreated, true, t)

    logger.info('Video live %s with uuid %s created.', videoInfo.name, videoCreated.uuid)

    return { videoCreated }
  })

  Hooks.runAction('action:api.live-video.created', { video: videoCreated })

  return res.json({
    video: {
      id: videoCreated.id,
      uuid: videoCreated.uuid
    }
  })
}
