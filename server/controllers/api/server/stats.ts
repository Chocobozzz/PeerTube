import * as express from 'express'
import { ServerStats } from '../../../../shared/models/server/server-stats.model'
import { asyncMiddleware } from '../../../middlewares'
import { UserModel } from '../../../models/account/user'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'

const statsRouter = express.Router()

statsRouter.get('/stats',
  asyncMiddleware(getStats)
)

async function getStats (req: express.Request, res: express.Response, next: express.NextFunction) {
  const { totalLocalVideos, totalLocalVideoViews, totalVideos } = await VideoModel.getStats()
  const { totalLocalVideoComments, totalVideoComments } = await VideoCommentModel.getStats()
  const { totalUsers } = await UserModel.getStats()
  const { totalInstanceFollowers, totalInstanceFollowing } = await ActorFollowModel.getStats()

  const data: ServerStats = {
    totalLocalVideos,
    totalLocalVideoViews,
    totalVideos,
    totalLocalVideoComments,
    totalVideoComments,
    totalUsers,
    totalInstanceFollowers,
    totalInstanceFollowing
  }

  return res.json(data).end()
}

// ---------------------------------------------------------------------------

export {
  statsRouter
}
