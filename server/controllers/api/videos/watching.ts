import * as express from 'express'
import { UserWatchingVideo } from '../../../../shared'
import { asyncMiddleware, asyncRetryTransactionMiddleware, authenticate, videoWatchingValidator } from '../../../middlewares'
import { UserVideoHistoryModel } from '../../../models/account/user-video-history'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const watchingRouter = express.Router()

watchingRouter.put('/:videoId/watching',
  authenticate,
  asyncMiddleware(videoWatchingValidator),
  asyncRetryTransactionMiddleware(userWatchVideo)
)

// ---------------------------------------------------------------------------

export {
  watchingRouter
}

// ---------------------------------------------------------------------------

async function userWatchVideo (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  const body: UserWatchingVideo = req.body
  const { id: videoId } = res.locals.videoId

  await UserVideoHistoryModel.upsert({
    videoId,
    userId: user.id,
    currentTime: body.currentTime
  })

  return res.type('json')
            .status(HttpStatusCode.NO_CONTENT_204)
            .end()
}
