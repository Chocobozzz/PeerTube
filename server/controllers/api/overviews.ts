import * as express from 'express'
import { buildNSFWFilter } from '../../helpers/express-utils'
import { VideoModel } from '../../models/video/video'
import { asyncMiddleware } from '../../middlewares'
import { TagModel } from '../../models/video/tag'
import { VideosOverview } from '../../../shared/models/overviews'
import { OVERVIEWS, ROUTE_CACHE_LIFETIME } from '../../initializers'
import { cacheRoute } from '../../middlewares/cache'

const overviewsRouter = express.Router()

overviewsRouter.get('/videos',
  asyncMiddleware(cacheRoute(ROUTE_CACHE_LIFETIME.OVERVIEWS.VIDEOS)),
  asyncMiddleware(getVideosOverview)
)

// ---------------------------------------------------------------------------

export { overviewsRouter }

// ---------------------------------------------------------------------------

// This endpoint could be quite long, but we cache it
async function getVideosOverview (req: express.Request, res: express.Response) {
  const attributes = await buildSamples()
  const result: VideosOverview = {
    categories: await Promise.all(attributes.categories.map(c => getVideosByCategory(c, res))),
    channels: await Promise.all(attributes.channels.map(c => getVideosByChannel(c, res))),
    tags: await Promise.all(attributes.tags.map(t => getVideosByTag(t, res)))
  }

  // Cleanup our object
  for (const key of Object.keys(result)) {
    result[key] = result[key].filter(v => v !== undefined)
  }

  return res.json(result)
}

async function buildSamples () {
  const [ categories, channels, tags ] = await Promise.all([
    VideoModel.getRandomFieldSamples('category', OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, OVERVIEWS.VIDEOS.SAMPLES_COUNT),
    VideoModel.getRandomFieldSamples('channelId', OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD ,OVERVIEWS.VIDEOS.SAMPLES_COUNT),
    TagModel.getRandomSamples(OVERVIEWS.VIDEOS.SAMPLE_THRESHOLD, OVERVIEWS.VIDEOS.SAMPLES_COUNT)
  ])

  return { categories, channels, tags }
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
  const { data } = await VideoModel.listForApi(Object.assign({
    start: 0,
    count: 10,
    sort: '-createdAt',
    includeLocalVideos: true,
    nsfw: buildNSFWFilter(res),
    withFiles: false
  }, where))

  return data.map(d => d.toFormattedJSON())
}
