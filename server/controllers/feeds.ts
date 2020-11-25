import * as express from 'express'
import * as Feed from 'pfeed'
import { buildNSFWFilter } from '../helpers/express-utils'
import { CONFIG } from '../initializers/config'
import { FEEDS, ROUTE_CACHE_LIFETIME, THUMBNAILS_SIZE, WEBSERVER } from '../initializers/constants'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  feedsFormatValidator,
  setDefaultVideosSort,
  setFeedFormatContentType,
  videoCommentsFeedsValidator,
  videoFeedsValidator,
  videosSortValidator,
  videoSubscriptionFeedsValidator
} from '../middlewares'
import { cacheRoute } from '../middlewares/cache'
import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'
import { VideoFilter } from '../../shared/models/videos/video-query.type'

const feedsRouter = express.Router()

feedsRouter.get('/feeds/video-comments.:format',
  feedsFormatValidator,
  setFeedFormatContentType,
  asyncMiddleware(cacheRoute({
    headerBlacklist: [
      'Content-Type'
    ]
  })(ROUTE_CACHE_LIFETIME.FEEDS)),
  asyncMiddleware(videoFeedsValidator),
  asyncMiddleware(videoCommentsFeedsValidator),
  asyncMiddleware(generateVideoCommentsFeed)
)

feedsRouter.get('/feeds/videos.:format',
  videosSortValidator,
  setDefaultVideosSort,
  feedsFormatValidator,
  setFeedFormatContentType,
  asyncMiddleware(cacheRoute({
    headerBlacklist: [
      'Content-Type'
    ]
  })(ROUTE_CACHE_LIFETIME.FEEDS)),
  commonVideosFiltersValidator,
  asyncMiddleware(videoFeedsValidator),
  asyncMiddleware(generateVideoFeed)
)

feedsRouter.get('/feeds/subscriptions.:format',
  videosSortValidator,
  setDefaultVideosSort,
  feedsFormatValidator,
  setFeedFormatContentType,
  asyncMiddleware(cacheRoute({
    headerBlacklist: [
      'Content-Type'
    ]
  })(ROUTE_CACHE_LIFETIME.FEEDS)),
  commonVideosFiltersValidator,
  asyncMiddleware(videoSubscriptionFeedsValidator),
  asyncMiddleware(generateVideoFeedForSubscriptions)
)

// ---------------------------------------------------------------------------

export {
  feedsRouter
}

// ---------------------------------------------------------------------------

async function generateVideoCommentsFeed (req: express.Request, res: express.Response) {
  const start = 0
  const video = res.locals.videoAll
  const account = res.locals.account
  const videoChannel = res.locals.videoChannel

  const comments = await VideoCommentModel.listForFeed({
    start,
    count: FEEDS.COUNT,
    videoId: video ? video.id : undefined,
    accountId: account ? account.id : undefined,
    videoChannelId: videoChannel ? videoChannel.id : undefined
  })

  let name: string
  let description: string

  if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description
  } else if (account) {
    name = account.getDisplayName()
    description = account.description
  } else {
    name = video ? video.name : CONFIG.INSTANCE.NAME
    description = video ? video.description : CONFIG.INSTANCE.DESCRIPTION
  }
  const feed = initFeed({
    name,
    description,
    resourceType: 'video-comments',
    queryString: new URL(WEBSERVER.URL + req.originalUrl).search
  })

  // Adding video items to the feed, one at a time
  for (const comment of comments) {
    const link = WEBSERVER.URL + comment.getCommentStaticPath()

    let title = comment.Video.name
    const author: { name: string, link: string }[] = []

    if (comment.Account) {
      title += ` - ${comment.Account.getDisplayName()}`
      author.push({
        name: comment.Account.getDisplayName(),
        link: comment.Account.Actor.url
      })
    }

    feed.addItem({
      title,
      id: comment.url,
      link,
      content: comment.text,
      author,
      date: comment.createdAt
    })
  }

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

  const feed = initFeed({
    name,
    description,
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search
  })

  const options = {
    accountId: account ? account.id : null,
    videoChannelId: videoChannel ? videoChannel.id : null
  }

  const resultList = await VideoModel.listForApi({
    start,
    count: FEEDS.COUNT,
    sort: req.query.sort,
    includeLocalVideos: true,
    nsfw,
    filter: req.query.filter as VideoFilter,
    withFiles: true,
    ...options
  })

  addVideosToFeed(feed, resultList.data)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

async function generateVideoFeedForSubscriptions (req: express.Request, res: express.Response) {
  const start = 0
  const account = res.locals.account
  const nsfw = buildNSFWFilter(res, req.query.nsfw)
  const name = account.getDisplayName()
  const description = account.description

  const feed = initFeed({
    name,
    description,
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search
  })

  const resultList = await VideoModel.listForApi({
    start,
    count: FEEDS.COUNT,
    sort: req.query.sort,
    includeLocalVideos: false,
    nsfw,
    filter: req.query.filter as VideoFilter,
    withFiles: true,

    followerActorId: res.locals.user.Account.Actor.id,
    user: res.locals.user
  })

  addVideosToFeed(feed, resultList.data)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

function initFeed (parameters: {
  name: string
  description: string
  resourceType?: 'videos' | 'video-comments'
  queryString?: string
}) {
  const webserverUrl = WEBSERVER.URL
  const { name, description, resourceType, queryString } = parameters

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
      json: `${webserverUrl}/feeds/${resourceType}.json${queryString}`,
      atom: `${webserverUrl}/feeds/${resourceType}.atom${queryString}`,
      rss: `${webserverUrl}/feeds/${resourceType}.xml${queryString}`
    },
    author: {
      name: 'Instance admin of ' + CONFIG.INSTANCE.NAME,
      email: CONFIG.ADMIN.EMAIL,
      link: `${webserverUrl}/about`
    }
  })
}

function addVideosToFeed (feed, videos: VideoModel[]) {
  /**
   * Adding video items to the feed object, one at a time
   */
  for (const video of videos) {
    const formattedVideoFiles = video.getFormattedVideoFilesJSON()

    const torrents = formattedVideoFiles.map(videoFile => ({
      title: video.name,
      url: videoFile.torrentUrl,
      size_in_bytes: videoFile.size
    }))

    const videos = formattedVideoFiles.map(videoFile => {
      const result = {
        type: 'video/mp4',
        medium: 'video',
        height: videoFile.resolution.label.replace('p', ''),
        fileSize: videoFile.size,
        url: videoFile.fileUrl,
        framerate: videoFile.fps,
        duration: video.duration
      }

      if (video.language) Object.assign(result, { lang: video.language })

      return result
    })

    const categories: { value: number, label: string }[] = []
    if (video.category) {
      categories.push({
        value: video.category,
        label: VideoModel.getCategoryLabel(video.category)
      })
    }

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
      nsfw: video.nsfw,
      torrent: torrents,
      videos,
      embed: {
        url: video.getEmbedStaticPath(),
        allowFullscreen: true
      },
      player: {
        url: video.getWatchStaticPath()
      },
      categories,
      community: {
        statistics: {
          views: video.views
        }
      },
      thumbnail: [
        {
          url: WEBSERVER.URL + video.getMiniatureStaticPath(),
          height: THUMBNAILS_SIZE.height,
          width: THUMBNAILS_SIZE.width
        }
      ]
    })
  }
}

function sendFeed (feed, req: express.Request, res: express.Response) {
  const format = req.params.format

  if (format === 'atom' || format === 'atom1') {
    return res.send(feed.atom1()).end()
  }

  if (format === 'json' || format === 'json1') {
    return res.send(feed.json1()).end()
  }

  if (format === 'rss' || format === 'rss2') {
    return res.send(feed.rss2()).end()
  }

  // We're in the ambiguous '.xml' case and we look at the format query parameter
  if (req.query.format === 'atom' || req.query.format === 'atom1') {
    return res.send(feed.atom1()).end()
  }

  return res.send(feed.rss2()).end()
}
