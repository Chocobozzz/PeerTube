import { ResultList, VideoAIUsageType, VideoRecommendationScope, VideoRecommendationScopeType } from '@peertube/peertube-models'
import { getServerActor } from '@server/models/application/application.js'
import { TagModel } from '@server/models/video/tag.js'
import { VideoModel } from '@server/models/video/video.js'
import { MUserAccountId, MVideoWithRights } from '@server/types/models/index.js'

export type ListRecommendedVideosOptions = {
  // Recommendations are related to this video if provided
  video?: MVideoWithRights

  scope: VideoRecommendationScopeType

  count: number
  excludeVideoIds: number[]

  nsfw: boolean
  nsfwFlagsIncluded: number
  nsfwFlagsExcluded: number

  aiUsageOneOf?: VideoAIUsageType[]

  user?: MUserAccountId
}

export async function listRecommendedVideos (options: ListRecommendedVideosOptions): Promise<ResultList<VideoModel>> {
  const { video, scope, count, user } = options

  const serverActor = await getServerActor()

  const baseQuery = {
    ...buildScopeQuery(scope, video),

    nsfw: options.nsfw,
    nsfwFlagsIncluded: options.nsfwFlagsIncluded,
    nsfwFlagsExcluded: options.nsfwFlagsExcluded,

    aiUsageOneOf: options.aiUsageOneOf,

    displayOnlyForFollower: {
      actorId: serverActor.id,
      orLocalVideos: true
    },

    user,

    start: 0,
    sort: '-publishedAt',
    countVideos: false
  }

  const excludeVideoIds = video
    ? [ ...options.excludeVideoIds, video.id ]
    : [ ...options.excludeVideoIds ]

  const videos: VideoModel[] = []

  const tags = video
    ? await TagModel.listNamesOfVideo(video.id)
    : []

  // Videos sharing tags with the reference video first
  if (tags.length !== 0) {
    const { data } = await VideoModel.listForApi({
      ...baseQuery,

      count,
      tagsOneOf: tags,
      excludeVideoIds,
      excludeAlreadyWatched: !!user
    })

    videos.push(...data)
  }

  // Then fill up with the latest videos
  if (videos.length < count) {
    const { data } = await VideoModel.listForApi({
      ...baseQuery,

      count: count - videos.length,
      excludeVideoIds: [ ...excludeVideoIds, ...videos.map(v => v.id) ]
    })

    videos.push(...data)
  }

  return { data: videos, total: videos.length }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildScopeQuery (scope: VideoRecommendationScopeType, video?: MVideoWithRights) {
  switch (scope) {
    case VideoRecommendationScope.ACCOUNT:
      return { accountId: video.VideoChannel.Account.id }

    case VideoRecommendationScope.CHANNEL:
      return { videoChannelId: video.channelId }

    case VideoRecommendationScope.LOCAL:
      if (video && !video.isLocal()) return { host: video.VideoChannel.Actor.Server.host }

      return { isLocal: true }

    default:
      return {}
  }
}
