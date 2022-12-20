import express from 'express'
import { extname } from 'path'
import { Feed } from '@peertube/feed'
import { mdToOneLinePlainText, toSafeHtml } from '@server/helpers/markdown'
import { getServerActor } from '@server/models/application/application'
import { getCategoryLabel } from '@server/models/video/formatter/video-format-utils'
import { MAccountDefault, MChannelBannerAccountDefault, MVideoFullLight } from '@server/types/models'
import { ActorImageType, VideoInclude } from '@shared/models'
import { buildNSFWFilter } from '../helpers/express-utils'
import { CONFIG } from '../initializers/config'
import { MIMETYPES, PREVIEWS_SIZE, ROUTE_CACHE_LIFETIME, WEBSERVER } from '../initializers/constants'
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
import { cacheRouteFactory } from '../middlewares/cache/cache'
import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'

const feedsRouter = express.Router()

const cacheRoute = cacheRouteFactory({
  headerBlacklist: [ 'Content-Type' ]
})

feedsRouter.get('/feeds/video-comments.:format',
  feedsFormatValidator,
  setFeedFormatContentType,
  cacheRoute(ROUTE_CACHE_LIFETIME.FEEDS),
  asyncMiddleware(videoFeedsValidator),
  asyncMiddleware(videoCommentsFeedsValidator),
  asyncMiddleware(generateVideoCommentsFeed)
)

feedsRouter.get('/feeds/videos.:format',
  videosSortValidator,
  setDefaultVideosSort,
  feedsFormatValidator,
  setFeedFormatContentType,
  cacheRoute(ROUTE_CACHE_LIFETIME.FEEDS),
  commonVideosFiltersValidator,
  asyncMiddleware(videoFeedsValidator),
  asyncMiddleware(generateVideoFeed)
)

feedsRouter.get('/feeds/subscriptions.:format',
  videosSortValidator,
  setDefaultVideosSort,
  feedsFormatValidator,
  setFeedFormatContentType,
  cacheRoute(ROUTE_CACHE_LIFETIME.FEEDS),
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
    count: CONFIG.FEEDS.COMMENTS.COUNT,
    videoId: video ? video.id : undefined,
    accountId: account ? account.id : undefined,
    videoChannelId: videoChannel ? videoChannel.id : undefined
  })

  const { name, description, imageUrl } = buildFeedMetadata({ video, account, videoChannel })

  const feed = initFeed({
    name,
    description,
    imageUrl,
    resourceType: 'video-comments',
    queryString: new URL(WEBSERVER.URL + req.originalUrl).search
  })

  // Adding video items to the feed, one at a time
  for (const comment of comments) {
    const localLink = WEBSERVER.URL + comment.getCommentStaticPath()

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
      id: localLink,
      link: localLink,
      content: toSafeHtml(comment.text),
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

  const { name, description, imageUrl } = buildFeedMetadata({ videoChannel, account })

  const feed = initFeed({
    name,
    description,
    imageUrl,
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search
  })

  const options = {
    accountId: account ? account.id : null,
    videoChannelId: videoChannel ? videoChannel.id : null
  }

  const server = await getServerActor()
  const { data } = await VideoModel.listForApi({
    start,
    count: CONFIG.FEEDS.VIDEOS.COUNT,
    sort: req.query.sort,
    displayOnlyForFollower: {
      actorId: server.id,
      orLocalVideos: true
    },
    nsfw,
    isLocal: req.query.isLocal,
    include: req.query.include | VideoInclude.FILES,
    hasFiles: true,
    countVideos: false,
    ...options
  })

  addVideosToFeed(feed, data)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

async function generateVideoFeedForSubscriptions (req: express.Request, res: express.Response) {
  const start = 0
  const account = res.locals.account
  const nsfw = buildNSFWFilter(res, req.query.nsfw)

  const { name, description, imageUrl } = buildFeedMetadata({ account })

  const feed = initFeed({
    name,
    description,
    imageUrl,
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search
  })

  const { data } = await VideoModel.listForApi({
    start,
    count: CONFIG.FEEDS.VIDEOS.COUNT,
    sort: req.query.sort,
    nsfw,

    isLocal: req.query.isLocal,

    hasFiles: true,
    include: req.query.include | VideoInclude.FILES,

    countVideos: false,

    displayOnlyForFollower: {
      actorId: res.locals.user.Account.Actor.id,
      orLocalVideos: false
    },
    user: res.locals.user
  })

  addVideosToFeed(feed, data)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

function initFeed (parameters: {
  name: string
  description: string
  imageUrl: string
  resourceType?: 'videos' | 'video-comments'
  queryString?: string
}) {
  const webserverUrl = WEBSERVER.URL
  const { name, description, resourceType, queryString, imageUrl } = parameters

  return new Feed({
    title: name,
    description: mdToOneLinePlainText(description),
    // updated: TODO: somehowGetLatestUpdate, // optional, default = today
    id: webserverUrl,
    link: webserverUrl,
    image: imageUrl,
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

function addVideosToFeed (feed: Feed, videos: VideoModel[]) {
  for (const video of videos) {
    const formattedVideoFiles = video.getFormattedVideoFilesJSON(false)

    const torrents = formattedVideoFiles.map(videoFile => ({
      title: video.name,
      url: videoFile.torrentUrl,
      size_in_bytes: videoFile.size
    }))

    const videoFiles = formattedVideoFiles.map(videoFile => {
      const result = {
        type: MIMETYPES.VIDEO.EXT_MIMETYPE[extname(videoFile.fileUrl)],
        medium: 'video',
        height: videoFile.resolution.id,
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
        label: getCategoryLabel(video.category)
      })
    }

    const localLink = WEBSERVER.URL + video.getWatchStaticPath()

    feed.addItem({
      title: video.name,
      id: localLink,
      link: localLink,
      description: mdToOneLinePlainText(video.getTruncatedDescription()),
      content: toSafeHtml(video.description),
      author: [
        {
          name: video.VideoChannel.getDisplayName(),
          link: video.VideoChannel.Actor.url
        }
      ],
      date: video.publishedAt,
      nsfw: video.nsfw,
      torrents,

      // Enclosure
      video: videoFiles.length !== 0
        ? {
          url: videoFiles[0].url,
          length: videoFiles[0].fileSize,
          type: videoFiles[0].type
        }
        : undefined,

      // Media RSS
      videos: videoFiles,

      embed: {
        url: WEBSERVER.URL + video.getEmbedStaticPath(),
        allowFullscreen: true
      },
      player: {
        url: WEBSERVER.URL + video.getWatchStaticPath()
      },
      categories,
      community: {
        statistics: {
          views: video.views
        }
      },
      thumbnails: [
        {
          url: WEBSERVER.URL + video.getPreviewStaticPath(),
          height: PREVIEWS_SIZE.height,
          width: PREVIEWS_SIZE.width
        }
      ]
    })
  }
}

function sendFeed (feed: Feed, req: express.Request, res: express.Response) {
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

function buildFeedMetadata (options: {
  videoChannel?: MChannelBannerAccountDefault
  account?: MAccountDefault
  video?: MVideoFullLight
}) {
  const { video, videoChannel, account } = options

  let imageUrl = WEBSERVER.URL + '/client/assets/images/icons/icon-96x96.png'
  let name: string
  let description: string

  if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description

    if (videoChannel.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = WEBSERVER.URL + videoChannel.Actor.Avatars[0].getStaticPath()
    }
  } else if (account) {
    name = account.getDisplayName()
    description = account.description

    if (account.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = WEBSERVER.URL + account.Actor.Avatars[0].getStaticPath()
    }
  } else if (video) {
    name = video.name
    description = video.description
  } else {
    name = CONFIG.INSTANCE.NAME
    description = CONFIG.INSTANCE.DESCRIPTION
  }

  return { name, description, imageUrl }
}
