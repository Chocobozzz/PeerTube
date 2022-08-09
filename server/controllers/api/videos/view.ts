import express from 'express'
import { Hooks } from '@server/lib/plugins/hooks'
import { VideoViewsManager } from '@server/lib/views/video-views-manager'
import { MVideoId } from '@server/types/models'
import { HttpStatusCode, VideoView } from '@shared/models'
import { asyncMiddleware, methodsValidator, openapiOperationDoc, optionalAuthenticate, videoViewValidator } from '../../../middlewares'
import { UserVideoHistoryModel } from '../../../models/user/user-video-history'

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
    viewEvent: body.viewEvent
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
