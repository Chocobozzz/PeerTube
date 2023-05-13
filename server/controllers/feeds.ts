import express from 'express'
import { isNull, orderBy } from 'lodash'
import { extname, join } from 'path'
import { Feed } from '@peertube/feed'
import { CustomTag, CustomXMLNS, LiveItemStatus, Person } from '@peertube/feed/lib/typings'
import { mdToOneLinePlainText, toSafeHtml } from '@server/helpers/markdown'
import { Hooks } from '@server/lib/plugins/hooks'
import { cacheRouteFactory } from '@server/middlewares'
import { getServerActor } from '@server/models/application/application'
import { UserModel } from '@server/models/user/user'
import { getCategoryLabel } from '@server/models/video/formatter/video-format-utils'
import { MAccountDefault, MChannelBannerAccountDefault, MUser, MVideoFullLight } from '@server/types/models'
import { ActorImageType, VideoInclude, VideoResolution, VideoState, VideoStreamingPlaylistType } from '@shared/models'
import { buildNSFWFilter } from '../helpers/express-utils'
import { CONFIG } from '../initializers/config'
import { LAZY_STATIC_PATHS, MIMETYPES, PREVIEWS_SIZE, ROUTE_CACHE_LIFETIME, STATIC_PATHS, WEBSERVER } from '../initializers/constants'
import {
  asyncMiddleware,
  commonVideosFiltersValidator,
  feedsFormatValidator,
  setDefaultVideosSort,
  setFeedFormatContentType,
  setFeedPodcastContentType,
  videoCommentsFeedsValidator,
  videoFeedsPodcastValidator,
  videoFeedsValidator,
  videosSortValidator,
  videoSubscriptionFeedsValidator
} from '../middlewares'
import { VideoModel } from '../models/video/video'
import { VideoCaptionModel } from '../models/video/video-caption'
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

feedsRouter.get('/feeds/podcast/videos.xml',
  setFeedPodcastContentType,
  cacheRoute(ROUTE_CACHE_LIFETIME.FEEDS),
  asyncMiddleware(videoFeedsPodcastValidator),
  asyncMiddleware(generateVideoPodcastFeed)
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
    isPodcast: false,
    link,
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

  const { name, description, imageUrl, accountImageUrl, link, accountLink } = await buildFeedMetadata({ videoChannel, account })

  const feed = initFeed({
    name,
    description,
    link,
    isPodcast: false,
    imageUrl,
    author: { name, link: accountLink, imageUrl: accountImageUrl },
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

  const { name, description, imageUrl, link } = await buildFeedMetadata({ account })

  const feed = initFeed({
    name,
    description,
    link,
    isPodcast: false,
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

async function generateVideoPodcastFeed (req: express.Request, res: express.Response) {
  const start = 0
  const account = res.locals.account
  const videoChannel = res.locals.videoChannel
  const nsfw = buildNSFWFilter()

  const { name, description, imageUrl, accountImageUrl, email, link, accountLink } = await buildFeedMetadata({ videoChannel })

  const options = {
    accountId: account ? account.id : null,
    videoChannelId: videoChannel.id
  }

  const server = await getServerActor()
  const { data } = await VideoModel.listForApi({
    start,
    count: CONFIG.FEEDS.VIDEOS.COUNT,
    sort: '-publishedAt',
    displayOnlyForFollower: {
      actorId: server.id,
      orLocalVideos: true
    },
    nsfw,
    // Prevent podcast feeds from listing videos in other instances
    // helps prevent duplicates when they are indexed -- only the author should control them
    isLocal: true,
    include: VideoInclude.FILES,
    hasFiles: true,
    countVideos: false,
    ...options
  })

  const customTags: CustomTag[] = await Hooks.wrapObject(
    [],
    'filter:feed.podcast.channel.create-custom-tags.result',
    { videoChannel }
  )

  const customXMLNS: CustomXMLNS[] = await Hooks.wrapObject(
    [],
    'filter:feed.podcast.rss.create-custom-xmlns.result'
  )

  const feed = initFeed({
    name,
    description,
    link,
    isPodcast: true,
    imageUrl,
    ...(email && { locked: { isLocked: true, email } }), // Default to true because we have no way of offering a redirect yet
    person: [ { name, href: accountLink, img: accountImageUrl } ],
    resourceType: 'videos',
    queryString: new URL(WEBSERVER.URL + req.url).search,
    medium: 'video',
    customXMLNS,
    customTags
  })

  await addVideosToPodcastFeed(feed, data)

  // Now the feed generation is done, let's send it!
  return res.send(feed.podcast()).end()
}

function initFeed (parameters: {
  name: string
  description: string
  imageUrl: string
  isPodcast: boolean
  link?: string
  locked?: { isLocked: boolean, email: string }
  author?: {
    name: string
    link: string
    imageUrl: string
  }
  person?: Person[]
  resourceType?: 'videos' | 'video-comments'
  queryString?: string
  medium?: string
  stunServers?: string[]
  trackers?: string[]
  customXMLNS?: CustomXMLNS[]
  customTags?: CustomTag[]
}) {
  const webserverUrl = WEBSERVER.URL
  const {
    name, description, link, imageUrl, isPodcast, locked, author, person, resourceType, queryString, medium,
    stunServers, trackers, customXMLNS, customTags
  } = parameters

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
      rss: isPodcast ? `${webserverUrl}/feeds/podcast/videos.xml${queryString}` : `${webserverUrl}/feeds/${resourceType}.xml${queryString}`
    },
    stunServers,
    trackers,
    customXMLNS,
    customTags,
    author,
    person
  })
}

async function generatePodcastItem (video: VideoModel, liveItem: boolean, media: ({
  type: string
  length: number
  bitrate: number
  sources: { uri: string, contentType?: string }[]
  title: string
  language?: string
} | { sources: { uri: string }[], type: string, title: string })[]) {
  const customTags: CustomTag[] = await Hooks.wrapObject(
    [],
    'filter:feed.podcast.video.create-custom-tags.result',
    { video, liveItem }
  )

  const author = {
    name: video.VideoChannel.Account.getDisplayName(),
    href: video.VideoChannel.Account.Actor.url
  }
  const preview = video.hasPreview() && video.getPreview()
  const miniature = video.getMiniature()
  return {
    trackers: video.getTrackerUrls(),
    title: video.name,
    link: WEBSERVER.URL + video.getWatchStaticPath(),
    description: mdToOneLinePlainText(video.getTruncatedDescription()),
    content: toSafeHtml(video.description),
    ...(video.category && { category: [ { name: getCategoryLabel(video.category) } ] }),
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
    socialInteract: [
      { uri: video.url, protocol: 'activitypub', accountUrl: video.VideoChannel.Account.getLocalUrl() }
    ],
    thumbnails: [
      {
        ...(preview && {
          url: WEBSERVER.URL + join(LAZY_STATIC_PATHS.PREVIEWS, preview.filename),
          width: preview.width
        }),
        ...(miniature && {
          url: WEBSERVER.URL + join(STATIC_PATHS.THUMBNAILS, miniature.filename),
          width: miniature.width
        })
      }
    ],
    customTags
  }
}

async function addVideosToPodcastFeed (feed: Feed, videos: VideoModel[]) {
  // Generate feed specific to The Podcast Namespace
  for (const video of videos.filter(v => !v.isLive)) {
    const webTorrentVideos: {
      type: string
      length: number
      bitrate: number
      sources: { uri: string, contentType?: string }[]
      title: string
      language?: string
    }[] = video.getFormattedVideoFilesJSON(true).map(videoFile => {
      const isAudio = videoFile.resolution.id === VideoResolution.H_NOVIDEO
      const type = isAudio
        ? MIMETYPES.AUDIO.EXT_MIMETYPE[extname(videoFile.fileUrl)]
        : MIMETYPES.VIDEO.EXT_MIMETYPE[extname(videoFile.fileUrl)]
      const sources = [
        { uri: videoFile.fileUrl },
        { uri: videoFile.torrentUrl, contentType: 'application/x-bittorrent' }
      ]
      if (videoFile.magnetUri) {
        sources.push({ uri: videoFile.magnetUri })
      }
      const result = {
        type,
        title: videoFile.resolution.label,
        length: videoFile.size,
        bitrate: videoFile.size / video.duration * 8,
        sources
      }

      if (video.language) Object.assign(result, { language: video.language })

      return result
    })

    const sortedWebTorrentVideos = orderBy(webTorrentVideos, [ 'bitrate' ], [ 'desc' ])

    const streamingPlaylists = video.VideoStreamingPlaylists
      .filter((streamingPlaylist) => streamingPlaylist.type === VideoStreamingPlaylistType.HLS)
      .map(streamingPlaylist => ({
        type: 'application/x-mpegURL',
        title: 'HLS',
        sources: [
          { uri: streamingPlaylist.getMasterPlaylistUrl(video) }
        ],
        ...(video.language && { language: video.language })
      }))

    // Order matters here, the first media URI will be the "default"
    // So webtorrent .mp4s are default if enabled
    const media = [ ...sortedWebTorrentVideos, ...streamingPlaylists ].filter(m => m)

    const videoCaptions = await VideoCaptionModel.listVideoCaptions(video.id)

    const captions = videoCaptions?.map(caption => {
      const type = MIMETYPES.VIDEO_CAPTIONS.EXT_MIMETYPE[extname(caption.filename)]
      if (!type) return null
      return {
        url: caption.getFileUrl(video),
        language: caption.language,
        type,
        rel: 'captions'
      }
    }).filter(c => c)

    const liveItem = false

    const item = await generatePodcastItem(video, liveItem, media)

    feed.addPodcastItem({ ...item, ...{ subTitle: captions } })
  }

  // Filter live videos that are pending or in progress
  for (const video of videos.filter(v => v.isLive && v.state !== VideoState.LIVE_ENDED)) {
    const media = video.VideoStreamingPlaylists
      .filter((streamingPlaylist) => streamingPlaylist.type === VideoStreamingPlaylistType.HLS)
      .map((streamingPlaylist, index) => ({
        type: 'application/x-mpegURL',
        title: `Live Stream ${index + 1}`,
        sources: [
          { uri: streamingPlaylist.getMasterPlaylistUrl(video) }
        ],
        ...(video.language && { language: video.language })
      }))

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

    const liveItem = true

    const item = await generatePodcastItem(video, liveItem, media)

    feed.addPodcastLiveItem({ ...item, ...{ isLive: true, status, start: video.updatedAt.toISOString() } })
  }
}

function addVideosToFeed (feed: Feed, videos: VideoModel[]) {
  /**
   * Adding video items to the feed object, one at a time
   */
  for (const video of videos) {
    const formattedVideoFiles = video.getFormattedVideoFilesWithStreamingPlaylistsJSON(false)

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
  let email: string
  let link: string
  let accountLink: string
  let user: MUser

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

    user = await UserModel.loadById(videoChannel.Account.userId)
  } else if (account) {
    name = account.getDisplayName()
    description = account.description
    link = account.getLocalUrl()
    accountLink = link

    if (account.Actor.hasImage(ActorImageType.AVATAR)) {
      imageUrl = WEBSERVER.URL + account.Actor.Avatars[0].getStaticPath()
      accountImageUrl = imageUrl
    }

    user = await UserModel.loadById(account.userId)
  } else if (video) {
    name = video.name
    description = video.description
    link = video.url
  } else {
    name = CONFIG.INSTANCE.NAME
    description = CONFIG.INSTANCE.DESCRIPTION
    link = WEBSERVER.URL
  }

  // If the user is local, has a verified email address, and allows it to be publicly displayed
  // Return it so the owner can prove ownership of their feed
  if (user && isNull(user.pluginAuth) && user.emailVerified && user.isEmailPublic) {
    email = user.email
  }

  return { name, description, imageUrl, accountImageUrl, email, link, accountLink }
}
