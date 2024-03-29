import {
  Video,
  VideoAdditionalAttributes,
  VideoCommentPolicy,
  VideoDetails,
  VideoFile,
  VideoInclude,
  VideosCommonQueryAfterSanitize,
  VideoStreamingPlaylist
} from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { generateMagnetUri } from '@server/helpers/webtorrent.js'
import { tracer } from '@server/lib/opentelemetry/tracing.js'
import { getLocalVideoFileMetadataUrl } from '@server/lib/video-urls.js'
import { VideoViewsManager } from '@server/lib/views/video-views-manager.js'
import { isArray } from '../../../helpers/custom-validators/misc.js'
import {
  VIDEO_CATEGORIES,
  VIDEO_COMMENTS_POLICY,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_STATES
} from '../../../initializers/constants.js'
import { MServer, MStreamingPlaylistRedundanciesOpt, MVideoFormattable, MVideoFormattableDetails } from '../../../types/models/index.js'
import { MVideoFileRedundanciesOpt } from '../../../types/models/video/video-file.js'
import { sortByResolutionDesc } from './shared/index.js'

export type VideoFormattingJSONOptions = {
  completeDescription?: boolean

  additionalAttributes?: {
    state?: boolean
    waitTranscoding?: boolean
    scheduledUpdate?: boolean
    blacklistInfo?: boolean
    files?: boolean
    source?: boolean
    blockedOwner?: boolean
    automaticTags?: boolean
  }
}

export function guessAdditionalAttributesFromQuery (query: VideosCommonQueryAfterSanitize): VideoFormattingJSONOptions {
  if (!query?.include) return {}

  return {
    additionalAttributes: {
      state: !!(query.include & VideoInclude.NOT_PUBLISHED_STATE),
      waitTranscoding: !!(query.include & VideoInclude.NOT_PUBLISHED_STATE),
      scheduledUpdate: !!(query.include & VideoInclude.NOT_PUBLISHED_STATE),
      blacklistInfo: !!(query.include & VideoInclude.BLACKLISTED),
      files: !!(query.include & VideoInclude.FILES),
      source: !!(query.include & VideoInclude.SOURCE),
      blockedOwner: !!(query.include & VideoInclude.BLOCKED_OWNER),
      automaticTags: !!(query.include & VideoInclude.AUTOMATIC_TAGS)
    }
  }
}

// ---------------------------------------------------------------------------

export function videoModelToFormattedJSON (video: MVideoFormattable, options: VideoFormattingJSONOptions = {}): Video {
  const span = tracer.startSpan('peertube.VideoModel.toFormattedJSON')

  const userHistory = isArray(video.UserVideoHistories)
    ? video.UserVideoHistories[0]
    : undefined

  const videoObject: Video = {
    id: video.id,
    uuid: video.uuid,
    shortUUID: uuidToShort(video.uuid),

    url: video.url,

    name: video.name,
    category: {
      id: video.category,
      label: getCategoryLabel(video.category)
    },
    licence: {
      id: video.licence,
      label: getLicenceLabel(video.licence)
    },
    language: {
      id: video.language,
      label: getLanguageLabel(video.language)
    },
    privacy: {
      id: video.privacy,
      label: getPrivacyLabel(video.privacy)
    },
    nsfw: video.nsfw,

    truncatedDescription: video.getTruncatedDescription(),
    description: options && options.completeDescription === true
      ? video.description
      : video.getTruncatedDescription(),

    isLocal: video.isOwned(),
    duration: video.duration,

    aspectRatio: video.aspectRatio,

    views: video.views,
    viewers: VideoViewsManager.Instance.getTotalViewersOf(video),

    likes: video.likes,
    dislikes: video.dislikes,
    thumbnailPath: video.getMiniatureStaticPath(),
    previewPath: video.getPreviewStaticPath(),
    embedPath: video.getEmbedStaticPath(),
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    publishedAt: video.publishedAt,
    originallyPublishedAt: video.originallyPublishedAt,

    isLive: video.isLive,

    account: video.VideoChannel.Account.toFormattedSummaryJSON(),
    channel: video.VideoChannel.toFormattedSummaryJSON(),

    userHistory: userHistory
      ? { currentTime: userHistory.currentTime }
      : undefined,

    // Can be added by external plugins
    pluginData: (video as any).pluginData,

    ...buildAdditionalAttributes(video, options)
  }

  span.end()

  return videoObject
}

export function videoModelToFormattedDetailsJSON (video: MVideoFormattableDetails): VideoDetails {
  const span = tracer.startSpan('peertube.VideoModel.toFormattedDetailsJSON')

  const videoJSON = video.toFormattedJSON({
    completeDescription: true,
    additionalAttributes: {
      scheduledUpdate: true,
      blacklistInfo: true,
      files: true
    }
  }) as Video & Required<Pick<Video, 'files' | 'streamingPlaylists' | 'scheduledUpdate' | 'blacklisted' | 'blacklistedReason'>>

  const tags = video.Tags
    ? video.Tags.map(t => t.name)
    : []

  const detailsJSON = {
    ...videoJSON,

    support: video.support,
    descriptionPath: video.getDescriptionAPIPath(),
    channel: video.VideoChannel.toFormattedJSON(),
    account: video.VideoChannel.Account.toFormattedJSON(),
    tags,

    // TODO: remove, deprecated in PeerTube 6.2
    commentsEnabled: video.commentsPolicy !== VideoCommentPolicy.DISABLED,
    commentsPolicy: {
      id: video.commentsPolicy,
      label: VIDEO_COMMENTS_POLICY[video.commentsPolicy]
    },

    downloadEnabled: video.downloadEnabled,
    waitTranscoding: video.waitTranscoding,
    inputFileUpdatedAt: video.inputFileUpdatedAt,
    state: {
      id: video.state,
      label: getStateLabel(video.state)
    },

    trackerUrls: video.getTrackerUrls()
  }

  span.end()

  return detailsJSON
}

export function streamingPlaylistsModelToFormattedJSON (
  video: MVideoFormattable,
  playlists: MStreamingPlaylistRedundanciesOpt[]
): VideoStreamingPlaylist[] {
  if (isArray(playlists) === false) return []

  return playlists
    .map(playlist => ({
      id: playlist.id,
      type: playlist.type,

      playlistUrl: playlist.getMasterPlaylistUrl(video),
      segmentsSha256Url: playlist.getSha256SegmentsUrl(video),

      redundancies: isArray(playlist.RedundancyVideos)
        ? playlist.RedundancyVideos.map(r => ({ baseUrl: r.fileUrl }))
        : [],

      files: videoFilesModelToFormattedJSON(video, playlist.VideoFiles)
    }))
}

export function videoFilesModelToFormattedJSON (
  video: MVideoFormattable,
  videoFiles: MVideoFileRedundanciesOpt[],
  options: {
    includeMagnet?: boolean // default true
  } = {}
): VideoFile[] {
  const { includeMagnet = true } = options

  if (isArray(videoFiles) === false) return []

  const trackerUrls = includeMagnet
    ? video.getTrackerUrls()
    : []

  return videoFiles
    .filter(f => !f.isLive())
    .sort(sortByResolutionDesc)
    .map(videoFile => {
      return {
        id: videoFile.id,

        resolution: {
          id: videoFile.resolution,
          label: getResolutionLabel(videoFile.resolution)
        },

        width: videoFile.width,
        height: videoFile.height,

        magnetUri: includeMagnet && videoFile.hasTorrent()
          ? generateMagnetUri(video, videoFile, trackerUrls)
          : undefined,

        size: videoFile.size,
        fps: videoFile.fps,

        torrentUrl: videoFile.getTorrentUrl(),
        torrentDownloadUrl: videoFile.getTorrentDownloadUrl(),

        fileUrl: videoFile.getFileUrl(video),
        fileDownloadUrl: videoFile.getFileDownloadUrl(video),

        metadataUrl: videoFile.metadataUrl ?? getLocalVideoFileMetadataUrl(video, videoFile)
      }
    })
}

// ---------------------------------------------------------------------------

export function getCategoryLabel (id: number) {
  return VIDEO_CATEGORIES[id] || 'Unknown'
}

export function getLicenceLabel (id: number) {
  return VIDEO_LICENCES[id] || 'Unknown'
}

export function getLanguageLabel (id: string) {
  return VIDEO_LANGUAGES[id] || 'Unknown'
}

export function getPrivacyLabel (id: number) {
  return VIDEO_PRIVACIES[id] || 'Unknown'
}

export function getStateLabel (id: number) {
  return VIDEO_STATES[id] || 'Unknown'
}

export function getResolutionLabel (resolution: number) {
  if (resolution === 0) return 'Audio'

  return `${resolution}p`
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildAdditionalAttributes (video: MVideoFormattable, options: VideoFormattingJSONOptions) {
  const add = options.additionalAttributes

  const result: Partial<VideoAdditionalAttributes> = {}

  if (add?.state === true) {
    result.state = {
      id: video.state,
      label: getStateLabel(video.state)
    }
  }

  if (add?.waitTranscoding === true) {
    result.waitTranscoding = video.waitTranscoding
  }

  if (add?.scheduledUpdate === true && video.ScheduleVideoUpdate) {
    result.scheduledUpdate = {
      updateAt: video.ScheduleVideoUpdate.updateAt,
      privacy: video.ScheduleVideoUpdate.privacy || undefined
    }
  }

  if (add?.blacklistInfo === true) {
    result.blacklisted = !!video.VideoBlacklist
    result.blacklistedReason =
      video.VideoBlacklist
        ? video.VideoBlacklist.reason
        : null
  }

  if (add?.blockedOwner === true) {
    result.blockedOwner = video.VideoChannel.Account.isBlocked()

    const server = video.VideoChannel.Account.Actor.Server as MServer
    result.blockedServer = !!(server?.isBlocked())
  }

  if (add?.files === true) {
    result.streamingPlaylists = streamingPlaylistsModelToFormattedJSON(video, video.VideoStreamingPlaylists)
    result.files = videoFilesModelToFormattedJSON(video, video.VideoFiles)
  }

  if (add?.source === true) {
    result.videoSource = video.VideoSource?.toFormattedJSON() || null
  }

  if (add?.automaticTags === true) {
    result.automaticTags = (video.VideoAutomaticTags || []).map(t => t.AutomaticTag.name)
  }

  return result
}
