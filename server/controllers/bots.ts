import * as express from 'express'
import { asyncMiddleware } from '../middlewares'
import { CONFIG, ROUTE_CACHE_LIFETIME } from '../initializers'
import * as sitemapModule from 'sitemap'
import { logger } from '../helpers/logger'
import { VideoModel } from '../models/video/video'
import { VideoChannelModel } from '../models/video/video-channel'
import { AccountModel } from '../models/account/account'
import { cacheRoute } from '../middlewares/cache'
import { buildNSFWFilter } from '../helpers/express-utils'
import { truncate } from 'lodash'

const botsRouter = express.Router()

// Special route that add OpenGraph and oEmbed tags
// Do not use a template engine for a so little thing
botsRouter.use('/sitemap.xml',
  asyncMiddleware(cacheRoute(ROUTE_CACHE_LIFETIME.SITEMAP)),
  asyncMiddleware(getSitemap)
)

// ---------------------------------------------------------------------------

export {
  botsRouter
}

// ---------------------------------------------------------------------------

async function getSitemap (req: express.Request, res: express.Response) {
  let urls = getSitemapBasicUrls()

  urls = urls.concat(await getSitemapLocalVideoUrls())
  urls = urls.concat(await getSitemapVideoChannelUrls())
  urls = urls.concat(await getSitemapAccountUrls())

  const sitemap = sitemapModule.createSitemap({
    hostname: CONFIG.WEBSERVER.URL,
    urls: urls
  })

  sitemap.toXML((err, xml) => {
    if (err) {
      logger.error('Cannot generate sitemap.', { err })
      return res.sendStatus(500)
    }

    res.header('Content-Type', 'application/xml')
    res.send(xml)
  })
}

async function getSitemapVideoChannelUrls () {
  const rows = await VideoChannelModel.listLocalsForSitemap('createdAt')

  return rows.map(channel => ({
    url: CONFIG.WEBSERVER.URL + '/video-channels/' + channel.Actor.preferredUsername
  }))
}

async function getSitemapAccountUrls () {
  const rows = await AccountModel.listLocalsForSitemap('createdAt')

  return rows.map(channel => ({
    url: CONFIG.WEBSERVER.URL + '/accounts/' + channel.Actor.preferredUsername
  }))
}

async function getSitemapLocalVideoUrls () {
  const resultList = await VideoModel.listForApi({
    start: 0,
    count: undefined,
    sort: 'createdAt',
    includeLocalVideos: true,
    nsfw: buildNSFWFilter(),
    filter: 'local',
    withFiles: false
  })

  return resultList.data.map(v => ({
    url: CONFIG.WEBSERVER.URL + '/videos/watch/' + v.uuid,
    video: [
      {
        title: v.name,
        // Sitemap description should be < 2000 characters
        description: truncate(v.description || v.name, { length: 2000, omission: '...' }),
        player_loc: CONFIG.WEBSERVER.URL + '/videos/embed/' + v.uuid,
        thumbnail_loc: CONFIG.WEBSERVER.URL + v.getThumbnailStaticPath()
      }
    ]
  }))
}

function getSitemapBasicUrls () {
  const paths = [
    '/about/instance',
    '/videos/local'
  ]

  return paths.map(p => ({ url: CONFIG.WEBSERVER.URL + p }))
}
