import { Feed } from '@peertube/feed'
import { CustomTag, CustomXMLNS, LiveItemStatus } from '@peertube/feed/lib/typings/index.js'
import { maxBy, sortObjectComparator } from '@peertube/peertube-core-utils'
import { ActorImageType, VideoFile, VideoInclude, VideoResolution, VideoState } from '@peertube/peertube-models'
import { InternalEventEmitter } from '@server/lib/internal-event-emitter.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { getVideoFileMimeType } from '@server/lib/video-file.js'
import { buildPodcastGroupsCache, cacheRouteFactory, videoFeedsPodcastSetCacheKey } from '@server/middlewares/index.js'
import { MVideo, MVideoCaptionVideo, MVideoFullLight } from '@server/types/models/index.js'
import express from 'express'
import { extname } from 'path'
import { buildNSFWFilter } from '../../helpers/express-utils.js'
import { MIMETYPES, ROUTE_CACHE_LIFETIME, WEBSERVER } from '../../initializers/constants.js'
import { asyncMiddleware, setFeedPodcastContentType, videoFeedsPodcastValidator } from '../../middlewares/index.js'
import { VideoCaptionModel } from '../../models/video/video-caption.js'
import { VideoModel } from '../../models/video/video.js'
import { buildFeedMetadata, getCommonVideoFeedAttributes, getVideosForFeeds, initFeed } from './shared/index.js'

const videoPodcastFeedsRouter = express.Router()

// ---------------------------------------------------------------------------

const { middleware: podcastCacheRouteMiddleware, instance: podcastApiCache } = cacheRouteFactory({
  headerBlacklist: [ 'Content-Type' ]
})

for (const event of ([ 'video-created', 'video-updated', 'video-deleted' ] as const)) {
  InternalEventEmitter.Instance.on(event, ({ video }) => {
    if (video.remote) return

    podcastApiCache.clearGroupSafe(buildPodcastGroupsCache({ channelId: video.channelId }))
  })
}

for (const event of ([ 'channel-updated', 'channel-deleted' ] as const)) {
  InternalEventEmitter.Instance.on(event, ({ channel }) => {
    podcastApiCache.clearGroupSafe(buildPodcastGroupsCache({ channelId: channel.id }))
  })
}

// ---------------------------------------------------------------------------

videoPodcastFeedsRouter.get('/podcast/videos.xml',
  setFeedPodcastContentType,
  videoFeedsPodcastSetCacheKey,
  podcastCacheRouteMiddleware(ROUTE_CACHE_LIFETIME.FEEDS),
  asyncMiddleware(videoFeedsPodcastValidator),
  asyncMiddleware(generateVideoPodcastFeed)
)

// ---------------------------------------------------------------------------

export {
  videoPodcastFeedsRouter
}

// ---------------------------------------------------------------------------

async function generateVideoPodcastFeed (req: express.Request, res: express.Response) {
  const videoChannel = res.locals.videoChannel

  const { name, userName, description, imageUrl, accountImageUrl, email, link, accountLink } = await buildFeedMetadata({ videoChannel })

  const data = await getVideosForFeeds({
    sort: '-publishedAt',
    nsfw: buildNSFWFilter(),
    // Prevent podcast feeds from listing videos in other instances
    // helps prevent duplicates when they are indexed -- only the author should control them
    isLocal: true,
    include: VideoInclude.FILES,
    videoChannelId: videoChannel?.id
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

    locked: email
      ? { isLocked: true, email } // Default to true because we have no way of offering a redirect yet
      : undefined,

    person: [ { name: userName, href: accountLink, img: accountImageUrl } ],
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

type PodcastMedia =
  {
    type: string
    length: number
    bitrate: number
    sources: { uri: string, contentType?: string }[]
    title: string
    language?: string
  } |
  {
    sources: { uri: string }[]
    type: string
    title: string
  }

async function generatePodcastItem (options: {
  video: VideoModel
  liveItem: boolean
  media: PodcastMedia[]
}) {
  const { video, liveItem, media } = options

  const customTags: CustomTag[] = await Hooks.wrapObject(
    [],
    'filter:feed.podcast.video.create-custom-tags.result',
    { video, liveItem }
  )

  const account = video.VideoChannel.Account

  const author = {
    name: account.getDisplayName(),
    href: account.getClientUrl()
  }

  const commonAttributes = getCommonVideoFeedAttributes(video)
  const guid = liveItem
    ? `${video.uuid}_${video.publishedAt.toISOString()}`
    : commonAttributes.link

  let personImage: string

  if (account.Actor.hasImage(ActorImageType.AVATAR)) {
    const avatar = maxBy(account.Actor.Avatars, 'width')
    personImage = WEBSERVER.URL + avatar.getStaticPath()
  }

  return {
    guid,
    ...commonAttributes,

    trackers: video.getTrackerUrls(),

    author: [ author ],
    person: [
      {
        ...author,

        img: personImage
      }
    ],

    media,

    socialInteract: [
      {
        uri: video.url,
        protocol: 'activitypub',
        accountUrl: account.getClientUrl()
      }
    ],

    customTags
  }
}

async function addVideosToPodcastFeed (feed: Feed, videos: VideoModel[]) {
  const captionsGroup = await VideoCaptionModel.listCaptionsOfMultipleVideos(videos.map(v => v.id))

  for (const video of videos) {
    if (!video.isLive) {
      await addVODPodcastItem({ feed, video, captionsGroup })
    } else if (video.isLive && video.state !== VideoState.LIVE_ENDED) {
      await addLivePodcastItem({ feed, video })
    }
  }
}

async function addVODPodcastItem (options: {
  feed: Feed
  video: VideoModel
  captionsGroup: { [ id: number ]: MVideoCaptionVideo[] }
}) {
  const { feed, video, captionsGroup } = options

  const webVideos = video.getFormattedWebVideoFilesJSON(true)
    .map(f => buildVODWebVideoFile(video, f))
    .sort(sortObjectComparator('bitrate', 'desc'))

  const streamingPlaylistFiles = buildVODStreamingPlaylists(video)

  // Order matters here, the first media URI will be the "default"
  // So web videos are default if enabled
  const media = [ ...webVideos, ...streamingPlaylistFiles ]

  const videoCaptions = buildVODCaptions(video, captionsGroup[video.id])
  const item = await generatePodcastItem({ video, liveItem: false, media })

  feed.addPodcastItem({ ...item, subTitle: videoCaptions })
}

async function addLivePodcastItem (options: {
  feed: Feed
  video: VideoModel
}) {
  const { feed, video } = options

  let status: LiveItemStatus

  switch (video.state) {
    case VideoState.WAITING_FOR_LIVE:
      status = LiveItemStatus.pending
      break
    case VideoState.PUBLISHED:
      status = LiveItemStatus.live
      break
  }

  const item = await generatePodcastItem({ video, liveItem: true, media: buildLiveStreamingPlaylists(video) })

  feed.addPodcastLiveItem({ ...item, status, start: video.updatedAt.toISOString() })
}

// ---------------------------------------------------------------------------

function buildVODWebVideoFile (video: MVideo, videoFile: VideoFile) {
  const sources = [
    { uri: videoFile.fileUrl },
    { uri: videoFile.torrentUrl, contentType: 'application/x-bittorrent' }
  ]

  if (videoFile.magnetUri) {
    sources.push({ uri: videoFile.magnetUri })
  }

  return {
    type: getVideoFileMimeType(extname(videoFile.fileUrl), videoFile.resolution.id === VideoResolution.H_NOVIDEO),
    title: videoFile.resolution.label,
    length: videoFile.size,
    bitrate: videoFile.size / video.duration * 8,
    language: video.language,
    sources
  }
}

function buildVODStreamingPlaylists (video: MVideoFullLight) {
  const hls = video.getHLSPlaylist()
  if (!hls) return []

  return [
    {
      type: 'application/x-mpegURL',
      title: 'HLS',
      sources: [
        { uri: hls.getMasterPlaylistUrl(video) }
      ],
      language: video.language
    }
  ]
}

function buildLiveStreamingPlaylists (video: MVideoFullLight) {
  const hls = video.getHLSPlaylist()

  return [
    {
      type: 'application/x-mpegURL',
      title: `HLS live stream`,
      sources: [
        { uri: hls.getMasterPlaylistUrl(video) }
      ],
      language: video.language
    }
  ]
}

function buildVODCaptions (video: MVideo, videoCaptions: MVideoCaptionVideo[]) {
  return videoCaptions.map(caption => {
    const type = MIMETYPES.VIDEO_CAPTIONS.EXT_MIMETYPE[extname(caption.filename)]
    if (!type) return null

    return {
      url: caption.getFileUrl(video),
      language: caption.language,
      type,
      rel: 'captions'
    }
  }).filter(c => c)
}
