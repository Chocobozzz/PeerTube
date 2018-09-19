import * as express from 'express'
import { ServerStats } from '../../../../shared/models/server/server-stats.model'
import { asyncMiddleware } from '../../../middlewares'
import { UserModel } from '../../../models/account/user'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { VideoModel } from '../../../models/video/video'
import { VideoCommentModel } from '../../../models/video/video-comment'
import { VideoRedundancyModel } from '../../../models/redundancy/video-redundancy'
import { CONFIG, ROUTE_CACHE_LIFETIME } from '../../../initializers/constants'
import { cacheRoute } from '../../../middlewares/cache'

const statsRouter = express.Router()

statsRouter.get('/stats',
  asyncMiddleware(cacheRoute(ROUTE_CACHE_LIFETIME.STATS)),
  asyncMiddleware(getStats)
)

async function getStats (req: express.Request, res: express.Response, next: express.NextFunction) {
  const { totalLocalVideos, totalLocalVideoViews, totalVideos } = await VideoModel.getStats()
  const { totalLocalVideoComments, totalVideoComments } = await VideoCommentModel.getStats()
  const { totalUsers } = await UserModel.getStats()
  const { totalInstanceFollowers, totalInstanceFollowing } = await ActorFollowModel.getStats()

  const videosRedundancyStats = await Promise.all(
    CONFIG.REDUNDANCY.VIDEOS.STRATEGIES.map(r => {
      return VideoRedundancyModel.getStats(r.strategy)
        .then(stats => Object.assign(stats, { strategy: r.strategy, totalSize: r.size }))
    })
  )

  const data: ServerStats = {
    totalLocalVideos,
    totalLocalVideoViews,
    totalVideos,
    totalLocalVideoComments,
    totalVideoComments,
    totalUsers,
    totalInstanceFollowers,
    totalInstanceFollowing,
    videosRedundancy: videosRedundancyStats
  }

  return res.json(data).end()
}

// ---------------------------------------------------------------------------

export {
  statsRouter
}
