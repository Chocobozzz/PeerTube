import { VideoRecommendationScope } from '@peertube/peertube-models'
import { VIDEO_RECOMMENDATIONS } from '@server/initializers/constants.js'
import { listRecommendedVideos, ListRecommendedVideosOptions } from '@server/lib/video-recommendations.js'
import express from 'express'
import { buildNSFWFilters } from '../../../helpers/express-utils.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import { asyncMiddleware, openapiOperationDoc, optionalAuthenticate, videoRecommendationsValidator } from '../../../middlewares/index.js'

const recommendationVideosRouter = express.Router()

recommendationVideosRouter.get(
  '/videos',
  openapiOperationDoc({ operationId: 'getRecommendationVideos' }),
  optionalAuthenticate,
  asyncMiddleware(videoRecommendationsValidator),
  asyncMiddleware(listRecommendationVideos)
)

// ---------------------------------------------------------------------------

export { recommendationVideosRouter }

// ---------------------------------------------------------------------------

async function listRecommendationVideos (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithRights

  const apiOptions = await Hooks.wrapObject<ListRecommendedVideosOptions, 'filter:api.recommendations.videos.list.params'>(
    {
      ...buildNSFWFilters({ req, res }),

      video,
      // Respect the preference of the video owner by default
      scope: req.query.scope ?? video?.recommendationScope ?? VideoRecommendationScope.ALL,

      count: req.query.count ?? VIDEO_RECOMMENDATIONS.COUNT.DEFAULT,
      excludeVideoIds: req.query.excludeVideoIds ?? [],

      user: res.locals.oauth ? res.locals.oauth.token.User : undefined
    },
    'filter:api.recommendations.videos.list.params'
  )

  const resultList = await Hooks.wrapPromiseFun(
    listRecommendedVideos,
    apiOptions,
    'filter:api.recommendations.videos.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
