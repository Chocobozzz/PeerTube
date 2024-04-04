import express from 'express'
import { HttpStatusCode, VideoView } from '@peertube/peertube-models'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { VideoViewsManager } from '@server/lib/views/video-views-manager.js'
import { MVideoId } from '@server/types/models/index.js'
import {
  asyncMiddleware,
  methodsValidator,
  openapiOperationDoc,
  optionalAuthenticate,
  videoViewValidator
} from '../../../middlewares/index.js'
import { UserVideoHistoryModel } from '../../../models/user/user-video-history.js'

const viewRouter = express.Router()

viewRouter.all(
  [ '/:videoId/views', '/:videoId/watching' ],
  openapiOperationDoc({ operationId: 'addView' }),
  methodsValidator([ 'PUT', 'POST' ]),
  optionalAuthenticate,
  asyncMiddleware(videoViewValidator),
  asyncMiddleware(viewVideo)
)

// ---------------------------------------------------------------------------

export {
  viewRouter
}

// ---------------------------------------------------------------------------

async function viewVideo (req: express.Request, res: express.Response) {
  const video = res.locals.onlyImmutableVideo

  const body = req.body as VideoView

  const ip = req.ip
  const { successView } = await VideoViewsManager.Instance.processLocalView({
    video,
    ip,
    currentTime: body.currentTime,
    viewEvent: body.viewEvent,
    sessionId: body.sessionId
  })

  if (successView) {
    Hooks.runAction('action:api.video.viewed', { video, ip, req, res })
  }

  await updateUserHistoryIfNeeded(body, video, res)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function updateUserHistoryIfNeeded (body: VideoView, video: MVideoId, res: express.Response) {
  const user = res.locals.oauth?.token.User
  if (!user) return
  if (user.videosHistoryEnabled !== true) return

  await UserVideoHistoryModel.upsert({
    videoId: video.id,
    userId: user.id,
    currentTime: body.currentTime
  })
}
