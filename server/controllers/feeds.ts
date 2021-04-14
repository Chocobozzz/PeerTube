import * as express from 'express'
import * as Feed from 'pfeed-podcast'
import { groupBy, isNull, last, map, orderBy } from 'lodash'
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
import { VideoFilter } from '@shared/models'
import { VideoResolution, VideoStreamingPlaylistType } from '@shared/models'

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
  const format = req.query.format || req.params.format || 'rss'

  let name: string
  let description: string
  let link: string
  let image: string
  const author: {name: string, email: string, link: string, img?: string} = {
    name: 'Instance admin of ' + CONFIG.INSTANCE.NAME,
    email: CONFIG.ADMIN.EMAIL,
    link: `${WEBSERVER.URL}/about`
  }

  if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description
    link = videoChannel.getLocalUrl()

    author.name = videoChannel.Account.getDisplayName()
    if (!isNull(videoChannel.Actor.Avatar)) {
      image = WEBSERVER.URL + videoChannel.Actor.Avatar.getStaticPath()
    }
    if (!isNull(videoChannel.Account.Actor.Avatar)) {
      author.img = WEBSERVER.URL + videoChannel.Account.Actor.Avatar.getStaticPath()
    }
  } else if (account) {
    name = account.getDisplayName()
    description = account.description
    link = account.getLocalUrl()
    author.name = name
    if (!isNull(account.Actor.Avatar)) {
      image = WEBSERVER.URL + account.Actor.Avatar.getStaticPath()
      author.img = image
    }
  } else {
    name = CONFIG.INSTANCE.NAME
    description = CONFIG.INSTANCE.DESCRIPTION
    link = WEBSERVER.URL
  }

  const feed = initFeed({
    name,
    description,
    link,
    image,
    author,
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
    withCaptions: true,
    ...options
  })

  addVideosToFeed(feed, resultList.data, format)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

async function generateVideoFeedForSubscriptions (req: express.Request, res: express.Response) {
  const start = 0
  const account = res.locals.account
  const nsfw = buildNSFWFilter(res, req.query.nsfw)
  const name = account.getDisplayName()
  const description = account.description
  const format = req.query.format || req.params.format || 'rss'

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
    withCaptions: true,

    followerActorId: res.locals.user.Account.Actor.id,
    user: res.locals.user
  })

  addVideosToFeed(feed, resultList.data, format)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

function initFeed (parameters: {
  name: string
  description: string
  link?: string,
  image?: string,
  author?: {
    name: string,
    email: string,
    link: string
  },
  resourceType?: 'videos' | 'video-comments'
  queryString?: string
}) {
  const webserverUrl = WEBSERVER.URL
  const { name, description, link, image, author, resourceType, queryString } = parameters

  return new Feed({
    title: name,
    description,
    // updated: TODO: somehowGetLatestUpdate, // optional, default = today
    id: webserverUrl,
    link: link || webserverUrl,
    image: image || webserverUrl + '/client/assets/images/icons/icon-96x96.png',
    favicon: webserverUrl + '/client/assets/images/favicon.png',
    copyright: `All rights reserved, unless otherwise specified in the terms specified at ${webserverUrl}/about` +
    ` and potential licenses granted by each content's rightholder.`,
    generator: `Toraifōsu`, // ^.~
    feedLinks: {
      json: `${webserverUrl}/feeds/${resourceType}.json${queryString}`,
      atom: `${webserverUrl}/feeds/${resourceType}.atom${queryString}`,
      rss: `${webserverUrl}/feeds/${resourceType}.xml${queryString}`
    },
    author: author || {
      name: 'Instance admin of ' + CONFIG.INSTANCE.NAME,
      email: CONFIG.ADMIN.EMAIL,
      link: `${webserverUrl}/about`
    }
  })
}

function addVideosToFeed (feed, videos: VideoModel[], format: string) {
  /**
   * Adding video items to the feed object, one at a time
   */
  if (format === 'podcast') {
    // Generate feed specific to The Podcast Namespace
    for (const video of videos.filter(v => !v.isLive)) {
      const videos: {
        type: string,
        length: number,
        bitrate: number,
        sources: { uri: string, contentType?: string }[],
        height?: number,
        language?: string
      }[] = video.getFormattedVideoFilesJSON(false).map(videoFile => {
        const isAudio = videoFile.resolution.id === VideoResolution.H_NOVIDEO
        const result = {
          type: isAudio ? 'audio/mp4' : 'video/mp4',
          length: videoFile.size,
          bitrate: videoFile.size / video.duration * 8,
          sources: [
            { uri: videoFile.fileUrl },
            { uri: videoFile.torrentUrl, contentType: 'application/x-bittorrent' }
          ]
        }

        if (!isAudio) Object.assign(result, { height: videoFile.resolution.id })
        if (video.language) Object.assign(result, { language: video.language })

        return result
      })

      // If both webtorrent and HLS are enabled, prefer webtorrent files
      // standard files for webtorrent are regular MP4s
      const groupedVideos = groupBy(videos, video => video.height || 0)
      const preferredVideos = map(groupedVideos, videoGroup => {
        if (videoGroup.length == 1) {
          return videoGroup[0]
        }
        return videoGroup.find(v => v.sources.some(s => s.uri.includes("/webseed/")))
      })

      const sortedVideos = orderBy(preferredVideos, ['bitrate'], ['desc'])

      const streamingPlaylists = video.VideoStreamingPlaylists
        .map(streamingPlaylist => {
          let type = '';
          if (streamingPlaylist.type === VideoStreamingPlaylistType.HLS) {
            type = 'application/x-mpegURL'
          } else {
            return {}
          }
          const result = {
            type,
            sources: [
              { uri: streamingPlaylist.playlistUrl }
            ]
          }

          if (video.language) Object.assign(result, { language: video.language })

          return result
        })

      const media = [...sortedVideos, ...streamingPlaylists]

      const categories: { value: number, label: string }[] = []
      if (video.Tags) {
        video.Tags.forEach((tag, index) =>{
          categories.push({value: index, label: tag.name})
        })
      }
      if (video.category) {
        categories.push({
          value: video.category,
          label: VideoModel.getCategoryLabel(video.category)
        })
      }

      const captions = video.VideoCaptions.map(caption => {
        const fileExtension = last(caption.filename.split("."))
        let type: string
        if (fileExtension === "srt") {
          type = "application/srt"
        } else if (fileExtension === "vtt") {
          type = "text/vtt"
        }
        if (!type) return {}
        return {
          url: WEBSERVER.URL + "/lazy-static/video-captions/" + caption.filename,
          language: caption.language,
          type,
          rel: "captions"
        }
      })

      const item = {
        title: video.name,
        // Live videos need unique GUIDs
        id: video.url,
        link: WEBSERVER.URL + '/videos/watch/' + video.uuid,
        description: video.description,
        author: [
          {
            name: video.VideoChannel.Account.getDisplayName(),
            href: video.VideoChannel.Account.Actor.url
          }
        ],
        date: video.publishedAt,
        explicit: video.nsfw,
        media,
        categories,
        subTitle: captions,
        thumbnail: [
          {
            url: WEBSERVER.URL + video.getMiniatureStaticPath()
          }
        ]
      }

      if (!isNull(video.VideoChannel.Account.Actor.Avatar)) {
        Object.assign(item.author[0], {
          img: WEBSERVER.URL + video.VideoChannel.Account.Actor.Avatar.getStaticPath()
        })
      }

      feed.addItem(item)
    }
  } else {
    for (const video of videos) {
      const formattedVideoFiles = video.getFormattedVideoFilesJSON(false)

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
}

function sendFeed (feed, req: express.Request, res: express.Response) {
  const format = req.query.format || req.params.format

  if (format === 'atom' || format === 'atom1') {
    return res.send(feed.atom1()).end()
  }

  if (format === 'json' || format === 'json1') {
    return res.send(feed.json1()).end()
  }

  if (format === 'rss' || format === 'rss2') {
    return res.send(feed.rss2()).end()
  }

  if (format === 'podcast') {
    return res.send(feed.podcast()).end()
  }

  // We're in the ambiguous '.xml' case and we look at the format query parameter
  if (req.query.format === 'atom' || req.query.format === 'atom1') {
    return res.send(feed.atom1()).end()
  }

  return res.send(feed.rss2()).end()
}
