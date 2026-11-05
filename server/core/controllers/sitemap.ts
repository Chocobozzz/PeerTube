import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoFileStream, VideoInclude, VideoIncludeType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { mdToUnescapedPlainText } from '@server/helpers/markdown.js'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { allowReplicaReadsToController } from '@server/middlewares/replica-reads.js'
import { getServerActor } from '@server/models/application/application.js'
import { MVideoSitemap } from '@server/types/models/index.js'
import express from 'express'
import truncate from 'lodash-es/truncate.js'
import { EnumYesNo, ErrorLevel, IndexItem, SitemapIndexStream, SitemapItemLoose, SitemapStream, streamToPromise } from 'sitemap'
import { buildNSFWFilters } from '../helpers/express-utils.js'
import { ROUTE_CACHE_LIFETIME, SITEMAP, WEBSERVER } from '../initializers/constants.js'
import { apiRateLimiter, asyncMiddleware, cacheRoute, sitemapPageValidator } from '../middlewares/index.js'
import { AccountModel } from '../models/account/account.js'
import { VideoChannelModel } from '../models/video/video-channel.js'
import { VideoModel } from '../models/video/video.js'

const logger = createLogger()

const sitemapRouter = express.Router()

sitemapRouter.get(
  '/sitemap.xml',
  apiRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.SITEMAP),
  asyncMiddleware(allowReplicaReadsToController(getSitemapIndex))
)

sitemapRouter.get(
  '/sitemaps/pages.xml',
  apiRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.SITEMAP),
  asyncMiddleware(getPagesSitemap)
)

sitemapRouter.get(
  '/sitemaps/videos/:page.xml',
  apiRateLimiter,
  sitemapPageValidator,
  cacheRoute(ROUTE_CACHE_LIFETIME.SITEMAP),
  asyncMiddleware(allowReplicaReadsToController(getVideosSitemap))
)

sitemapRouter.get(
  '/sitemaps/channels/:page.xml',
  apiRateLimiter,
  sitemapPageValidator,
  cacheRoute(ROUTE_CACHE_LIFETIME.SITEMAP),
  asyncMiddleware(allowReplicaReadsToController(getChannelsSitemap))
)

sitemapRouter.get(
  '/sitemaps/accounts/:page.xml',
  apiRateLimiter,
  sitemapPageValidator,
  cacheRoute(ROUTE_CACHE_LIFETIME.SITEMAP),
  asyncMiddleware(allowReplicaReadsToController(getAccountsSitemap))
)

// ---------------------------------------------------------------------------

export {
  sitemapRouter
}

// ---------------------------------------------------------------------------

async function getSitemapIndex (req: express.Request, res: express.Response) {
  const [ videoPages, channelPages, accountPages ] = await Promise.all([
    VideoModel.listIdRangePages({ ...await buildLocalVideosQuery(), idsPerPage: SITEMAP.VIDEOS_PER_PAGE }),
    VideoChannelModel.listLocalSitemapPages(SITEMAP.ACTORS_PER_PAGE),
    AccountModel.listLocalSitemapPages(SITEMAP.ACTORS_PER_PAGE)
  ])

  const items: IndexItem[] = [
    { url: WEBSERVER.URL + '/sitemaps/pages.xml' },

    ...buildSitemapIndexItems('videos', videoPages),
    ...buildSitemapIndexItems('channels', channelPages),
    ...buildSitemapIndexItems('accounts', accountPages)
  ]

  // The index stream doesn't support a custom error handler, and logs warnings in the console: throw instead
  const sitemapIndexStream = new SitemapIndexStream({ level: ErrorLevel.THROW })

  return sendSitemapStream(res, sitemapIndexStream, items)
}

async function getPagesSitemap (req: express.Request, res: express.Response) {
  const paths = [
    '/',
    '/about/instance/home',
    '/videos/browse'
  ]

  if (ServerConfigManager.Instance.isHomepageEnabled()) {
    paths.push('/home')
  }

  const urls = await Hooks.wrapObject(
    paths.map(p => ({ url: WEBSERVER.URL + p })),
    'filter:sitemap.pages.list.result'
  )

  return sendSitemapPage(res, urls)
}

async function getVideosSitemap (req: express.Request, res: express.Response) {
  return sendSitemapPage(res, await getLocalVideoUrls(getPageIdRange(req, SITEMAP.VIDEOS_PER_PAGE)))
}

async function getChannelsSitemap (req: express.Request, res: express.Response) {
  const rows = await VideoChannelModel.listLocalsForSitemap(getPageIdRange(req, SITEMAP.ACTORS_PER_PAGE))

  return sendSitemapPage(res, rows.map(channel => ({ url: channel.getClientUrl(), lastmod: channel.updatedAt.toISOString() })))
}

async function getAccountsSitemap (req: express.Request, res: express.Response) {
  const rows = await AccountModel.listLocalsForSitemap(getPageIdRange(req, SITEMAP.ACTORS_PER_PAGE))

  return sendSitemapPage(res, rows.map(account => ({ url: account.getClientUrl(), lastmod: account.updatedAt.toISOString() })))
}

// ---------------------------------------------------------------------------

function buildSitemapIndexItems (type: 'videos' | 'channels' | 'accounts', pages: { page: number, lastUpdatedAt: Date }[]): IndexItem[] {
  return pages.map(({ page, lastUpdatedAt }) => ({
    url: `${WEBSERVER.URL}/sitemaps/${type}/${page}.xml`,
    lastmod: lastUpdatedAt.toISOString()
  }))
}

function getPageIdRange (req: express.Request, idsPerPage: number) {
  const page = forceNumber(req.params.page)

  return { min: (page - 1) * idsPerPage + 1, max: page * idsPerPage }
}

async function sendSitemapPage (res: express.Response, urls: SitemapItemLoose[]) {
  // The page doesn't exist (anymore)
  if (urls.length === 0) {
    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Sitemap page not found'
    })
  }

  const sitemapStream = new SitemapStream({
    hostname: WEBSERVER.URL,
    errorHandler: (err: Error, level: ErrorLevel) => {
      if (level === ErrorLevel.WARN) {
        logger.warn('Warning in sitemap generation.', { err })
      } else if (level === ErrorLevel.THROW) {
        logger.error('Error in sitemap generation.', { err })

        throw err
      }
    }
  })

  return sendSitemapStream(res, sitemapStream, urls)
}

async function sendSitemapStream<T> (res: express.Response, stream: SitemapStream | SitemapIndexStream, items: T[]) {
  for (const item of items) {
    stream.write(item)
  }
  stream.end()

  let xml: Buffer

  try {
    xml = await streamToPromise(stream)
  } catch (err) {
    logger.error('Error in sitemap generation.', { err })

    throw err
  }

  res.header('Content-Type', 'application/xml')
  res.send(xml)
}

// ---------------------------------------------------------------------------

async function buildLocalVideosQuery () {
  const serverActor = await getServerActor()

  return {
    ...buildNSFWFilters(),

    displayOnlyForFollower: {
      actorId: serverActor.id,
      orLocalVideos: true
    },
    isLocal: true
  }
}

async function getLocalVideoUrls (idRange: { min: number, max: number }) {
  const query = await buildLocalVideosQuery()
  const include: VideoIncludeType = VideoInclude.FILES | VideoInclude.TAGS

  // Don't load all the videos of the page at once: they include their files and tags
  const chunkSize = 200

  let urls: SitemapItemLoose[] = []

  for (let min = idRange.min; min <= idRange.max; min += chunkSize) {
    // Don't use offset that can be slow on large tables with a high value
    const chunkIdRange = { min, max: Math.min(min + chunkSize - 1, idRange.max) }

    const { data } = await VideoModel.listForApi({
      ...query,

      sort: 'id',
      start: 0,
      count: chunkSize,
      idRange: chunkIdRange,
      countVideos: false,
      include
    })

    urls = urls.concat(data.map(v => buildVideoUrl(v)))
  }

  return urls
}

function buildVideoUrl (v: MVideoSitemap): SitemapItemLoose {
  const contentLoc = v.getHLSPlaylist()?.getMasterPlaylistUrl(v) ||
    v.getMaxQualityFile(VideoFileStream.VIDEO)?.getFileUrl(v) ||
    v.getMaxQualityFile(VideoFileStream.AUDIO)?.getFileUrl(v)

  return {
    url: process.env.EXPERIMENTAL_SITEMAP_VIDEO_URL === 'true'
      ? WEBSERVER.URL + '/videos/watch/' + v.uuid
      : WEBSERVER.URL + v.getWatchStaticPath(),
    lastmod: (v.sitemapContentUpdatedAt ?? v.publishedAt).toISOString(),
    video: [
      {
        // Sitemap title should be < 100 characters
        'title': truncate(v.name, { length: 100, omission: '...' }),
        // Sitemap description should be < 2000 characters
        'description': truncate(mdToUnescapedPlainText(v.description) || v.name, { length: 2000, omission: '...' }),
        'player_loc': v.getEmbedStaticUrl(),
        'thumbnail_loc': v.getSmallestThumbnailUrl('16:9'),
        'content_loc': contentLoc,
        'duration': v.duration,
        'view_count': v.views,
        'publication_date': v.publishedAt.toISOString(),
        'uploader': v.VideoChannel.getDisplayName(),
        'uploader:info': v.VideoChannel.getClientUrl(),
        'live': v.isLive ? EnumYesNo.YES : EnumYesNo.NO,
        'family_friendly': v.nsfw ? EnumYesNo.NO : EnumYesNo.YES,
        'rating': (v.likes * 5) / (v.likes + v.dislikes) || 0, // Rating is between 0.0 and 5.0
        'tag': v.Tags.map(t => t.name)
      }
    ]
  }
}
