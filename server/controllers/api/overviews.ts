import * as express from 'express'
import { buildNSFWFilter } from '../../helpers/express-utils'
import { VideoModel } from '../../models/video/video'
import { asyncMiddleware } from '../../middlewares'
import { TagModel } from '../../models/video/tag'
import { VideosOverview } from '../../../shared/models/overviews'
import { MEMOIZE_TTL, OVERVIEWS, ROUTE_CACHE_LIFETIME } from '../../initializers/constants'
import { cacheRoute } from '../../middlewares/cache'
import * as memoizee from 'memoizee'

const overviewsRouter = express.Router()

overviewsRouter.get('/videos',
  asyncMiddleware(cacheRoute()(ROUTE_CACHE_LIFETIME.OVERVIEWS.VIDEOS)),
  asyncMiddleware(getVideosOverview)
)

// ---------------------------------------------------------------------------

export { overviewsRouter }

// ---------------------------------------------------------------------------

const buildSamples = memoizee(async function () {
  const [ categories, channels, tags ] = await Promise.all([
    VideoModel.getRandomFieldSamples('category', OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, OVERVIEWS.VIDEOS.SAMPLES_COUNT),
    VideoModel.getRandomFieldSamples('channelId', OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, OVERVIEWS.VIDEOS.SAMPLES_COUNT),
    TagModel.getRandomSamples(OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, OVERVIEWS.VIDEOS.SAMPLES_COUNT)
  ])

  return { categories, channels, tags }
}, { maxAge: MEMOIZE_TTL.OVERVIEWS_SAMPLE })

// This endpoint could be quite long, but we cache it
async function getVideosOverview (req: express.Request, res: express.Response) {
  const attributes = await buildSamples()

  const [ categories, channels, tags ] = await Promise.all([
    Promise.all(attributes.categories.map(c => getVideosByCategory(c, res))),
    Promise.all(attributes.channels.map(c => getVideosByChannel(c, res))),
    Promise.all(attributes.tags.map(t => getVideosByTag(t, res)))
  ])

  const result: VideosOverview = {
    categories,
    channels,
    tags
  }

  // Cleanup our object
  for (const key of Object.keys(result)) {
    result[key] = result[key].filter(v => v !== undefined)
  }

  return res.json(result)
}

async function getVideosByTag (tag: string, res: express.Response) {
  const videos = await getVideos(res, { tagsOneOf: [ tag ] })

  if (videos.length === 0) return undefined

  return {
    tag,
    videos
  }
}

async function getVideosByCategory (category: number, res: express.Response) {
  const videos = await getVideos(res, { categoryOneOf: [ category ] })

  if (videos.length === 0) return undefined

  return {
    category: videos[0].category,
    videos
  }
}

async function getVideosByChannel (channelId: number, res: express.Response) {
  const videos = await getVideos(res, { videoChannelId: channelId })

  if (videos.length === 0) return undefined

  return {
    channel: videos[0].channel,
    videos
  }
}

async function getVideos (
  res: express.Response,
  where: { videoChannelId?: number, tagsOneOf?: string[], categoryOneOf?: number[] }
) {
  const query = Object.assign({
    start: 0,
    count: 12,
    sort: '-createdAt',
    includeLocalVideos: true,
    nsfw: buildNSFWFilter(res),
    withFiles: false,
    countVideos: false
  }, where)

  const { data } = await VideoModel.listForApi(query)

  return data.map(d => d.toFormattedJSON())
}
