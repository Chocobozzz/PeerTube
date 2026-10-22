import { HttpStatusCode, VideoRecommendationStrategy, VideoRecommendationStrategyType } from '@peertube/peertube-models'
import { pickCommonVideoQuery } from '@server/helpers/query.js'
import { getServerActor } from '@server/models/application/application.js'
import express from 'express'
import { buildNSFWFilters, getCountVideos } from '../../../helpers/express-utils.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import {
  asyncMiddleware,
  commonVideosFiltersValidatorFactory,
  openapiOperationDoc,
  optionalAuthenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultVideosSort,
  videoRecommendationsValidator,
  videosSortValidator
} from '../../../middlewares/index.js'
import { guessAdditionalAttributesFromQuery } from '../../../models/video/formatter/index.js'
import { VideoModel } from '../../../models/video/video.js'

const recommendationVideosRouter = express.Router()

recommendationVideosRouter.get(
  '/videos',
  openapiOperationDoc({ operationId: 'getRecommendationVideos' }),
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
  setDefaultPagination,
  optionalAuthenticate,
  commonVideosFiltersValidatorFactory(),
  videoRecommendationsValidator,
  asyncMiddleware(listRecommendationVideos)
)

// ---------------------------------------------------------------------------

export { recommendationVideosRouter }

// ---------------------------------------------------------------------------

async function listRecommendationVideos (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const query = pickCommonVideoQuery(req.query)
  const countVideos = getCountVideos(req)

  const strategy = req.query.strategy as unknown as VideoRecommendationStrategyType
  const videoId = req.query.videoId as string

  let accountId: number
  let videoChannelId: number
  let host = query.host
  let isLocal = query.isLocal

  const video = videoId
    ? await VideoModel.loadAndPopulateAccount(videoId)
    : undefined

  if (videoId && !video) {
    return res.fail({ status: HttpStatusCode.NOT_FOUND_404, message: 'Video not found' })
  }

  if (strategy === VideoRecommendationStrategy.ONLY_OWNER_VIDEOS) {
    accountId = video.VideoChannel.Account.id
  } else if (strategy === VideoRecommendationStrategy.ONLY_CHANNEL_VIDEOS) {
    videoChannelId = video.channelId
  } else if (strategy === VideoRecommendationStrategy.ONLY_LOCAL_VIDEOS) {
    // "Local" means local to the instance that owns the video, so remote instances respect the uploader choice
    if (video && !video.isLocal()) {
      host = video.VideoChannel.Actor.Server.host
      isLocal = undefined
    } else {
      isLocal = true
    }
  }

  const apiOptions = await Hooks.wrapObject(
    {
      ...query,
      ...buildNSFWFilters({ req, res }),

      isLocal,
      host,
      accountId,
      videoChannelId,

      displayOnlyForFollower: {
        actorId: serverActor.id,
        orLocalVideos: true
      },

      user: res.locals.oauth ? res.locals.oauth.token.User : undefined,
      countVideos
    },
    'filter:api.recommendations.videos.list.params'
  )

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listForApi.bind(VideoModel),
    apiOptions,
    'filter:api.recommendations.videos.list.result'
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total, guessAdditionalAttributesFromQuery(query)))
}
