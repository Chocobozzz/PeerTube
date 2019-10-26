import * as express from 'express'
import { FEEDS, ROUTE_CACHE_LIFETIME, THUMBNAILS_SIZE, WEBSERVER } from '../initializers/constants'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  setDefaultSort,
  videoCommentsFeedsValidator,
  videoFeedsValidator,
  videosSortValidator
} from '../middlewares'
import { VideoModel } from '../models/video/video'
import * as Feed from 'pfeed'
import { cacheRoute } from '../middlewares/cache'
import { VideoCommentModel } from '../models/video/video-comment'
import { buildNSFWFilter } from '../helpers/express-utils'
import { CONFIG } from '../initializers/config'

const feedsRouter = express.Router()

feedsRouter.get('/feeds/video-comments.:format',
  asyncMiddleware(cacheRoute(ROUTE_CACHE_LIFETIME.FEEDS)),
  asyncMiddleware(videoCommentsFeedsValidator),
  asyncMiddleware(generateVideoCommentsFeed)
)

feedsRouter.get('/feeds/videos.:format',
  videosSortValidator,
  setDefaultSort,
  asyncMiddleware(cacheRoute(ROUTE_CACHE_LIFETIME.FEEDS)),
  commonVideosFiltersValidator,
  asyncMiddleware(videoFeedsValidator),
  asyncMiddleware(generateVideoFeed)
)

// ---------------------------------------------------------------------------

export {
  feedsRouter
}

// ---------------------------------------------------------------------------

async function generateVideoCommentsFeed (req: express.Request, res: express.Response) {
  const start = 0

  const video = res.locals.videoAll
  const videoId: number = video ? video.id : undefined

  const comments = await VideoCommentModel.listForFeed(start, FEEDS.COUNT, videoId)

  const name = video ? video.name : CONFIG.INSTANCE.NAME
  const description = video ? video.description : CONFIG.INSTANCE.DESCRIPTION
  const feed = initFeed(name, description)

  // Adding video items to the feed, one at a time
  comments.forEach(comment => {
    const link = WEBSERVER.URL + comment.getCommentStaticPath()

    feed.addItem({
      title: `${comment.Video.name} - ${comment.Account.getDisplayName()}`,
      id: comment.url,
      link,
      content: comment.text,
      author: [
        {
          name: comment.Account.getDisplayName(),
          link: comment.Account.Actor.url
        }
      ],
      date: comment.createdAt
    })
  })

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

async function generateVideoFeed (req: express.Request, res: express.Response) {
  const start = 0

  const account = res.locals.account
  const videoChannel = res.locals.videoChannel
  const nsfw = buildNSFWFilter(res, req.query.nsfw)

  let name: string
  let description: string

  if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description
  } else if (account) {
    name = account.getDisplayName()
    description = account.description
  } else {
    name = CONFIG.INSTANCE.NAME
    description = CONFIG.INSTANCE.DESCRIPTION
  }

  const feed = initFeed(name, description)

  const resultList = await VideoModel.listForApi({
    start,
    count: FEEDS.COUNT,
    sort: req.query.sort,
    includeLocalVideos: true,
    nsfw,
    filter: req.query.filter,
    withFiles: true,
    accountId: account ? account.id : null,
    videoChannelId: videoChannel ? videoChannel.id : null
  })

  // Adding video items to the feed, one at a time
  resultList.data.forEach(video => {
    const formattedVideoFiles = video.getFormattedVideoFilesJSON()
    const torrents = formattedVideoFiles.map(videoFile => ({
      title: video.name,
      url: videoFile.torrentUrl,
      size_in_bytes: videoFile.size
    }))

    feed.addItem({
      title: video.name,
      id: video.url,
      link: WEBSERVER.URL + '/videos/watch/' + video.uuid,
      description: video.getTruncatedDescription(),
      content: video.description,
      author: [
        {
          name: video.VideoChannel.Account.getDisplayName(),
          link: video.VideoChannel.Account.Actor.url
        }
      ],
      date: video.publishedAt,
      language: video.language,
      nsfw: video.nsfw,
      torrent: torrents,
      thumbnail: [
        {
          url: WEBSERVER.URL + video.getMiniatureStaticPath(),
          height: THUMBNAILS_SIZE.height,
          width: THUMBNAILS_SIZE.width
        }
      ]
    })
  })

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

function initFeed (name: string, description: string) {
  const webserverUrl = WEBSERVER.URL

  return new Feed({
    title: name,
    description,
    // updated: TODO: somehowGetLatestUpdate, // optional, default = today
    id: webserverUrl,
    link: webserverUrl,
    image: webserverUrl + '/client/assets/images/icons/icon-96x96.png',
    favicon: webserverUrl + '/client/assets/images/favicon.png',
    copyright: `All rights reserved, unless otherwise specified in the terms specified at ${webserverUrl}/about` +
    ` and potential licenses granted by each content's rightholder.`,
    generator: `Toraifōsu`, // ^.~
    feedLinks: {
      json: `${webserverUrl}/feeds/videos.json`,
      atom: `${webserverUrl}/feeds/videos.atom`,
      rss: `${webserverUrl}/feeds/videos.xml`
    },
    author: {
      name: 'Instance admin of ' + CONFIG.INSTANCE.NAME,
      email: CONFIG.ADMIN.EMAIL,
      link: `${webserverUrl}/about`
    }
  })
}

function sendFeed (feed, req: express.Request, res: express.Response) {
  const format = req.params.format

  if (format === 'atom' || format === 'atom1') {
    res.set('Content-Type', 'application/atom+xml')
    return res.send(feed.atom1()).end()
  }

  if (format === 'json' || format === 'json1') {
    res.set('Content-Type', 'application/json')
    return res.send(feed.json1()).end()
  }

  if (format === 'rss' || format === 'rss2') {
    res.set('Content-Type', 'application/rss+xml')
    return res.send(feed.rss2()).end()
  }

  // We're in the ambiguous '.xml' case and we look at the format query parameter
  if (req.query.format === 'atom' || req.query.format === 'atom1') {
    res.set('Content-Type', 'application/atom+xml')
    return res.send(feed.atom1()).end()
  }

  res.set('Content-Type', 'application/rss+xml')
  return res.send(feed.rss2()).end()
}
