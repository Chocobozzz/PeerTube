import express from 'express'
import truncate from 'lodash-es/truncate.js'
import { ErrorLevel, SitemapStream, streamToPromise } from 'sitemap'
import { logger } from '@server/helpers/logger.js'
import { getServerActor } from '@server/models/application/application.js'
import { buildNSFWFilter } from '../helpers/express-utils.js'
import { ROUTE_CACHE_LIFETIME, WEBSERVER } from '../initializers/constants.js'
import { apiRateLimiter, asyncMiddleware } from '../middlewares/index.js'
import { cacheRoute } from '../middlewares/cache/cache.js'
import { AccountModel } from '../models/account/account.js'
import { VideoModel } from '../models/video/video.js'
import { VideoChannelModel } from '../models/video/video-channel.js'

const sitemapRouter = express.Router()

sitemapRouter.use('/sitemap.xml',
  apiRateLimiter,
  cacheRoute(ROUTE_CACHE_LIFETIME.SITEMAP),
  asyncMiddleware(getSitemap)
)

// ---------------------------------------------------------------------------

export {
  sitemapRouter
}

// ---------------------------------------------------------------------------

async function getSitemap (req: express.Request, res: express.Response) {
  let urls = getSitemapBasicUrls()

  urls = urls.concat(await getSitemapLocalVideoUrls())
  urls = urls.concat(await getSitemapVideoChannelUrls())
  urls = urls.concat(await getSitemapAccountUrls())

  const sitemapStream = new SitemapStream({
    hostname: WEBSERVER.URL,
    errorHandler: (err: Error, level: ErrorLevel) => {
      if (level === 'warn') {
        logger.warn('Warning in sitemap generation.', { err })
      } else if (level === 'throw') {
        logger.error('Error in sitemap generation.', { err })

        throw err
      }
    }
  })

  for (const urlObj of urls) {
    sitemapStream.write(urlObj)
  }
  sitemapStream.end()

  const xml = await streamToPromise(sitemapStream)

  res.header('Content-Type', 'application/xml')
  res.send(xml)
}

async function getSitemapVideoChannelUrls () {
  const rows = await VideoChannelModel.listLocalsForSitemap('createdAt')

  return rows.map(channel => ({
    url: WEBSERVER.URL + '/video-channels/' + channel.Actor.preferredUsername
  }))
}

async function getSitemapAccountUrls () {
  const rows = await AccountModel.listLocalsForSitemap('createdAt')

  return rows.map(channel => ({
    url: WEBSERVER.URL + '/accounts/' + channel.Actor.preferredUsername
  }))
}

async function getSitemapLocalVideoUrls () {
  const serverActor = await getServerActor()

  const { data } = await VideoModel.listForApi({
    start: 0,
    count: undefined,
    sort: 'createdAt',
    displayOnlyForFollower: {
      actorId: serverActor.id,
      orLocalVideos: true
    },
    isLocal: true,
    nsfw: buildNSFWFilter(),
    countVideos: false
  })

  return data.map(v => ({
    url: WEBSERVER.URL + v.getWatchStaticPath(),
    video: [
      {
        // Sitemap title should be < 100 characters
        title: truncate(v.name, { length: 100, omission: '...' }),
        // Sitemap description should be < 2000 characters
        description: truncate(v.description || v.name, { length: 2000, omission: '...' }),
        player_loc: WEBSERVER.URL + v.getEmbedStaticPath(),
        thumbnail_loc: WEBSERVER.URL + v.getMiniatureStaticPath()
      }
    ]
  }))
}

function getSitemapBasicUrls () {
  const paths = [
    '/about/instance',
    '/videos/local'
  ]

  return paths.map(p => ({ url: WEBSERVER.URL + p }))
}
