import { getChannelPodcastFeed, getPlaylistPodcastFeed } from '@peertube/peertube-core-utils'
import { VideoIncludeType } from '@peertube/peertube-models'
import { mdToPlainText, toSafeHtml } from '@server/helpers/markdown.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { getServerActor } from '@server/models/application/application.js'
import { getCategoryLabel } from '@server/models/video/formatter/index.js'
import { DisplayOnlyForFollowerOptions } from '@server/models/video/sql/video/index.js'
import { VideoModel } from '@server/models/video/video.js'
import { MChannelHostOnly, MUserDefault, MVideoPlaylist } from '@server/types/models/index.js'

export async function getVideosForFeeds (options: {
  sort: string
  nsfw: boolean
  isLocal: boolean
  include: VideoIncludeType

  accountId?: number
  videoChannelId?: number
  videoPlaylistId?: number
  displayOnlyForFollower?: DisplayOnlyForFollowerOptions
  user?: MUserDefault
}) {
  const server = await getServerActor()

  const { data } = await Hooks.wrapPromiseFun(
    VideoModel.listForApi.bind(VideoModel),
    {
      start: 0,
      count: CONFIG.FEEDS.VIDEOS.COUNT,
      displayOnlyForFollower: {
        actorId: server.id,
        orLocalVideos: true
      },
      hasFiles: true,
      countVideos: false,

      ...options
    },
    'filter:feed.videos.list.result'
  )

  return data
}

export function getCommonVideoFeedAttributes (video: VideoModel) {
  const localLink = WEBSERVER.URL + video.getWatchStaticPath()

  let thumbnails = video.filterThumbnails('1:1')
  if (thumbnails.length === 0) thumbnails = video.filterThumbnails('16:9')

  return {
    title: video.name,
    link: localLink,
    description: mdToPlainText(video.getTruncatedDescription()),
    content: toSafeHtml(video.description),

    date: video.publishedAt,
    nsfw: video.nsfw,

    category: video.category
      ? [ { name: getCategoryLabel(video.category) } ]
      : undefined,

    thumbnails: thumbnails.map(t => ({
      url: WEBSERVER.URL + t.getFileStaticPath(),
      width: t.width,
      height: t.height
    }))
  }
}

export function getPodcastChannelFeedUrlCustomTag (videoChannel: MChannelHostOnly) {
  return {
    name: 'podcast:txt',
    attributes: {
      purpose: 'p20url'
    },
    // TODO: use remote channel podcast feed URL
    value: getChannelPodcastFeed(WEBSERVER.URL, videoChannel)
  }
}

export function getPodcastPlaylistFeedUrlCustomTag (playlist: Pick<MVideoPlaylist, 'id'>) {
  return {
    name: 'podcast:txt',
    attributes: {
      purpose: 'p20url'
    },
    // TODO: use remote channel podcast feed URL
    value: getPlaylistPodcastFeed(WEBSERVER.URL, playlist)
  }
}
