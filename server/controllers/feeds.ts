import express from 'express'
import { groupBy, isNull, map, orderBy } from 'lodash'
import { extname } from 'path'
import { Feed } from 'pfeed-podcast'
import { CustomTag, LiveItemStatus } from 'pfeed-podcast/lib/typings'
import { mdToOneLinePlainText, toSafeHtml } from '@server/helpers/markdown'
import { getServerActor } from '@server/models/application/application'
import { getCategoryLabel } from '@server/models/video/formatter/video-format-utils'
import { MAccountDefault, MChannelBannerAccountDefault, MVideoFullLight } from '@server/types/models'
import { ActorImageType, VideoInclude, VideoResolution, VideoState, VideoStreamingPlaylistType } from '@shared/models'
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
import { VideoCaptionModel } from '../models/video/video-caption'
import { VideoCommentModel } from '../models/video/video-comment'
import { UserModel } from '@server/models/user/user'

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

  const { name, description, imageUrl, link } = await buildFeedMetadata({ video, account, videoChannel })

  const feed = initFeed({
    name,
    description,
    imageUrl,
    link,
    resourceType: 'video-comments',
    queryString: new URL(WEBSERVER.URL + req.originalUrl).search,
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
  const format = req.query.format || req.params.format || 'rss'

  const { name, description, imageUrl, accountImageUrl, email, link, accountLink } = await buildFeedMetadata({ videoChannel, account })

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
    isLocal: true,
    include: req.query.include | VideoInclude.FILES,
    // TODO: include tags for future inclusion into the RSS feed
    //include: req.query.include | VideoInclude.FILES | VideoInclude.TAGS,
    hasFiles: true,
    countVideos: false,
    ...options
  })

  // If the first video in the channel is a film, that will be the only video in the feed
  // Yes, this is a hack :)
  const isFilm: boolean = data.length > 0 && data[data.length - 1].category === 2
  const videos = isFilm ? [ data[data.length - 1] ] : data

  // TODO: Add customTags hook for the channel level here
  /*const customTags: CustomTag[] = await Hooks.wrapObject(
    [],
    'filter:feed.podcast.channel.custom-tags.result',
    { account, videoChannel }
  )*/

  const feed = initFeed({
    name: isFilm ? videos[0].name : name,
    description: isFilm ? videos[0].description : description,
    link: isFilm ? videos[0].url : link,
    imageUrl: isFilm ? WEBSERVER.URL + videos[0].getPreviewStaticPath() : imageUrl,
    locked: { isLocked: true, email }, // Default to true because we have no way of offering a redirect etc
    author: { name, link: accountLink, imageUrl: accountImageUrl },
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search,
    medium: isFilm ? 'film' : 'video',
    format,
  })

  await addVideosToFeed(feed, videos, format)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

async function generateVideoFeedForSubscriptions (req: express.Request, res: express.Response) {
  const start = 0
  const account = res.locals.account
  const nsfw = buildNSFWFilter(res, req.query.nsfw)
  const format = req.query.format || req.params.format || 'rss'

  const { name, description, imageUrl, link } = await buildFeedMetadata({ account })

  const feed = initFeed({
    name,
    description,
    link,
    imageUrl,
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search,
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

  await addVideosToFeed(feed, data, format)

  // Now the feed generation is done, let's send it!
  return sendFeed(feed, req, res)
}

function initFeed (parameters: {
  name: string
  description: string
  imageUrl: string
  link?: string
  locked?: { isLocked: boolean, email: string }
  author?: {
    name: string
    link: string
    imageUrl: string
  }
  resourceType?: 'videos' | 'video-comments'
  queryString?: string
  medium?: string
  format?: string
  customTags?: CustomTag[]
}) {
  const webserverUrl = WEBSERVER.URL
  const { name, description, link, imageUrl, locked, author, resourceType, queryString, medium, format, customTags } = parameters

  return new Feed({
    title: name,
    description: mdToOneLinePlainText(description),
    // updated: TODO: somehowGetLatestUpdate, // optional, default = today
    id: link || webserverUrl,
    link: link || webserverUrl,
    image: imageUrl,
    favicon: webserverUrl + '/client/assets/images/favicon.png',
    copyright: `All rights reserved, unless otherwise specified in the terms specified at ${webserverUrl}/about` +
    ` and potential licenses granted by each content's rightholder.`,
    generator: `Toraifōsu`, // ^.~
    medium: medium || 'video',
    locked,
    feedLinks: {
      json: `${webserverUrl}/feeds/${resourceType}.json${queryString}`,
      atom: `${webserverUrl}/feeds/${resourceType}.atom${queryString}`,
      rss: `${webserverUrl}/feeds/${resourceType}.xml${queryString}`
    },
    customTags,
    ...(format && format !== "podcast" && author),
    ...(format === "podcast" && author && { name: author.name, href: author.link, img: author.imageUrl }),
  })
}

async function addVideosToFeed (feed: Feed, videos: VideoModel[], format: string) {
  /**
   * Adding video items to the feed object, one at a time
   */
  if (format === 'podcast') {
    // Generate feed specific to The Podcast Namespace
    for (const video of videos.filter(v => !v.isLive)) {
      const videos: {
        type: string
        length: number
        bitrate: number
        sources: { uri: string, contentType?: string }[]
        title: string
        language?: string
      }[] = video.getFormattedVideoFilesJSON(false).map(videoFile => {
        const isAudio = videoFile.resolution.id === VideoResolution.H_NOVIDEO
        const result = {
          type: MIMETYPES.AUDIO.MIMETYPE_EXT[extname(videoFile.fileUrl)],
          title: isAudio ? "Audio" : videoFile.resolution.label,
          length: videoFile.size,
          bitrate: videoFile.size / video.duration * 8,
          sources: [
            { uri: videoFile.fileUrl },
            { uri: videoFile.torrentUrl, contentType: 'application/x-bittorrent' }
          ]
        }

        if (video.language) Object.assign(result, { language: video.language })

        return result
      })

      // If both webtorrent and HLS are enabled, prefer webtorrent files
      // standard files for webtorrent are regular MP4s
      const groupedVideos = groupBy(videos, video => video.title)
      const preferredVideos = map(groupedVideos, videoGroup => {
        return videoGroup.find(v => {
          return v.sources.some(s => s.uri.includes("/webseed/") || (!s.uri.includes("-fragmented") && !s.uri.includes("-hls")))
        })
      })

      const sortedVideos = orderBy(preferredVideos, [ 'bitrate' ], [ 'desc' ])

      const streamingPlaylists = video.VideoStreamingPlaylists
        .map(streamingPlaylist => {
          let type = ''
          if (streamingPlaylist.type === VideoStreamingPlaylistType.HLS) {
            type = 'application/x-mpegURL'
          } else {
            return
          }
          const result = {
            type,
            title: "HLS",
            sources: [
              { uri: streamingPlaylist.getMasterPlaylistUrl(video) }
            ]
          }

          if (video.language) Object.assign(result, { language: video.language })

          return result
        })

      const media = [ ...sortedVideos, ...streamingPlaylists ].filter(m => m)

      let category: string
      if (video.category) {
        category = getCategoryLabel(video.category)
      }

      const videoCaptions = await VideoCaptionModel.listVideoCaptions(video.id)

      const captions = videoCaptions?.map(caption => {
        const type = MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT[extname(caption.filename)]
        if (!type) return
        return {
          url: caption.getFileUrl(video),
          language: caption.language,
          type,
          rel: "captions"
        }
      }).filter(c => c)

      // TODO: Add customTags hook for the channel level here
      /*const customTags: CustomTag[] = await Hooks.wrapObject(
        [],
        'filter:feed.podcast.item.custom-tags.result',
        { account, videoChannel }
      )*/

      const author = {
        name: video.VideoChannel.Account.getDisplayName(),
        href: video.VideoChannel.Account.Actor.url
      }
      const item = {
        trackers: video.getTrackerUrls(),
        title: video.name,
        link: WEBSERVER.URL + video.getWatchStaticPath(),
        description: mdToOneLinePlainText(video.getTruncatedDescription()),
        content: toSafeHtml(video.description),
        author: [
          author
        ],
        person: [
          {
            ...author,
            ...(video.VideoChannel.Account.Actor.hasImage(ActorImageType.AVATAR) && {
              img: WEBSERVER.URL + video.VideoChannel.Account.Actor.Avatars[0].getStaticPath()
            })
          }
        ],
        date: video.publishedAt,
        nsfw: video.nsfw,
        media,
        category: [{ name: category }],
        socialInteract: [
          { uri: video.url, protocol: "activitypub", accountUrl: video.VideoChannel.Account.getLocalUrl() }
        ],
        subTitle: captions,
        thumbnail: [
          {
            url: WEBSERVER.URL + video.getPreviewStaticPath()
          }
        ],
        //customTags,
      }

      feed.addPodcastItem(item)
    }

    // Filter live videos that are pending or in progress
    for (const video of videos.filter(v => v.isLive && v.state !== VideoState.LIVE_ENDED)) {
      const streamingPlaylists = video.VideoStreamingPlaylists
        .map((streamingPlaylist, index) => {
          let type = ''
          if (streamingPlaylist.type === VideoStreamingPlaylistType.HLS) {
            type = 'application/x-mpegURL'
          } else {
            return
          }
          const result = {
            type,
            title: `Live Stream ${index + 1}`,
            sources: [
              { uri: streamingPlaylist.getMasterPlaylistUrl(video) }
            ]
          }

          if (video.language) Object.assign(result, { language: video.language })

          return result
        }).filter(s => s)

      let category: string
      if (video.category) {
        category = getCategoryLabel(video.category)
      }

      let status: LiveItemStatus

      switch (video.state) {
        case VideoState.WAITING_FOR_LIVE:
          status = LiveItemStatus.pending
          break
        case VideoState.LIVE_ENDED:
          status = LiveItemStatus.ended
          break
        case VideoState.PUBLISHED:
          status = LiveItemStatus.live
          break
      }

      // TODO: Add customTags hook for the channel level here
      /*const customTags: CustomTag[] = await Hooks.wrapObject(
        [],
        'filter:feed.podcast.live-item.custom-tags.result',
        { account, videoChannel }
      )*/

      const author = {
        name: video.VideoChannel.Account.getDisplayName(),
        href: video.VideoChannel.Account.Actor.url
      }
      const item = {
        isLive: true,
        status,
        start: video.updatedAt.toISOString(),
        trackers: video.getTrackerUrls(),
        title: video.name,
        // Live videos need unique GUIDs
        id: video.url,
        link: WEBSERVER.URL + video.getWatchStaticPath(),
        description: mdToOneLinePlainText(video.getTruncatedDescription()),
        content: toSafeHtml(video.description),
        author: [
          author
        ],
        person: [
          {
            ...author,
            ...(video.VideoChannel.Account.Actor.hasImage(ActorImageType.AVATAR) && {
              img: WEBSERVER.URL + video.VideoChannel.Account.Actor.Avatars[0].getStaticPath()
            })
          }
        ],
        date: video.publishedAt,
        nsfw: video.nsfw,
        media: streamingPlaylists,
        category: [{ name: category }],
        socialInteract: [
          { uri: video.url, protocol: "activitypub", accountUrl: video.VideoChannel.Account.getLocalUrl() }
        ],
        thumbnail: [
          {
            url: WEBSERVER.URL + video.getPreviewStaticPath()
          }
        ],
        //customTags,
      }

      feed.addPodcastLiveItem(item)
    }
  } else {
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
            name: video.VideoChannel.Account.getDisplayName(),
            link: video.VideoChannel.Account.Actor.url
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
}

function sendFeed (feed: Feed, req: express.Request, res: express.Response) {
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

async function buildFeedMetadata (options: {
  videoChannel?: MChannelBannerAccountDefault
  account?: MAccountDefault
  video?: MVideoFullLight
}) {
  const { video, videoChannel, account } = options

  let imageUrl = WEBSERVER.URL + '/client/assets/images/icons/icon-96x96.png'
  let accountImageUrl: string
  let name: string
  let description: string
  // TODO: See if we need to allow admin-optin to show the email address in feeds
  let email = CONFIG.ADMIN.EMAIL
  let link: string
  let accountLink: string

  if (videoChannel) {
    name = videoChannel.getDisplayName()
    description = videoChannel.description
    link = videoChannel.getLocalUrl()
    accountLink = videoChannel.Account.getLocalUrl()

    if (videoChannel.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = WEBSERVER.URL + videoChannel.Actor.Avatars[0].getStaticPath()
    }

    if (videoChannel.Account.Actor.hasImage(ActorImageType.AVATAR)) {
      accountImageUrl = WEBSERVER.URL + videoChannel.Account.Actor.Avatars[0].getStaticPath()
    }

    const user = await UserModel.loadById(videoChannel.Account.userId)

    // Only allow local users for now
    if (isNull(user.pluginAuth) && user.emailVerified && user.isEmailPublic) {
      email = user.email
    }

  } else if (account) {
    name = account.getDisplayName()
    description = account.description
    link = account.getLocalUrl()
    accountLink = link

    if (account.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = WEBSERVER.URL + account.Actor.Avatars[0].getStaticPath()
      accountImageUrl = imageUrl
    }

    const user = await UserModel.loadById(account.userId)

    // Only allow local users for now
    if (isNull(user.pluginAuth) && user.emailVerified && user.isEmailPublic) {
      email = user.email
    }

  } else if (video) {
    name = video.name
    description = video.description
    link = video.url
  } else {
    name = CONFIG.INSTANCE.NAME
    description = CONFIG.INSTANCE.DESCRIPTION
    link = WEBSERVER.URL
  }

  return { name, description, imageUrl, accountImageUrl, email, link, accountLink }
}
