import { mdToOneLinePlainText, toSafeHtml } from '@server/helpers/markdown'
import { CONFIG } from '@server/initializers/config'
import { WEBSERVER } from '@server/initializers/constants'
import { getServerActor } from '@server/models/application/application'
import { getCategoryLabel } from '@server/models/video/formatter'
import { DisplayOnlyForFollowerOptions } from '@server/models/video/sql/video'
import { VideoModel } from '@server/models/video/video'
import { MThumbnail, MUserDefault } from '@server/types/models'
import { VideoInclude } from '@shared/models'

export async function getVideosForFeeds (options: {
  sort: string
  nsfw: boolean
  isLocal: boolean
  include: VideoInclude

  accountId?: number
  videoChannelId?: number
  displayOnlyForFollower?: DisplayOnlyForFollowerOptions
  user?: MUserDefault
}) {
  const server = await getServerActor()

  const { data } = await VideoModel.listForApi({
    start: 0,
    count: CONFIG.FEEDS.VIDEOS.COUNT,
    displayOnlyForFollower: {
      actorId: server.id,
      orLocalVideos: true
    },
    hasFiles: true,
    countVideos: false,

    ...options
  })

  return data
}

export function getCommonVideoFeedAttributes (video: VideoModel) {
  const localLink = WEBSERVER.URL + video.getWatchStaticPath()

  const thumbnailModels: MThumbnail[] = []
  if (video.hasPreview()) thumbnailModels.push(video.getPreview())
  thumbnailModels.push(video.getMiniature())

  return {
    title: video.name,
    link: localLink,
    description: mdToOneLinePlainText(video.getTruncatedDescription()),
    content: toSafeHtml(video.description),

    date: video.publishedAt,
    nsfw: video.nsfw,

    category: video.category
      ? [ { name: getCategoryLabel(video.category) } ]
      : undefined,

    thumbnails: thumbnailModels.map(t => ({
      url: WEBSERVER.URL + t.getLocalStaticPath(),
      width: t.width,
      height: t.height
    }))
  }
}
