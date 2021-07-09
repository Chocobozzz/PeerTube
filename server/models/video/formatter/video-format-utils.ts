import { uuidToShort } from '@server/helpers/uuid'
import { generateMagnetUri } from '@server/helpers/webtorrent'
import { getLocalVideoFileMetadataUrl } from '@server/lib/video-paths'
import { VideoFile } from '@shared/models/videos/video-file.model'
import { ActivityTagObject, ActivityUrlObject, VideoObject } from '../../../../shared/models/activitypub/objects'
import { Video, VideoDetails } from '../../../../shared/models/videos'
import { VideoStreamingPlaylist } from '../../../../shared/models/videos/video-streaming-playlist.model'
import { isArray } from '../../../helpers/custom-validators/misc'
import {
  MIMETYPES,
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PRIVACIES,
  VIDEO_STATES,
  WEBSERVER
} from '../../../initializers/constants'
import {
  getLocalVideoCommentsActivityPubUrl,
  getLocalVideoDislikesActivityPubUrl,
  getLocalVideoLikesActivityPubUrl,
  getLocalVideoSharesActivityPubUrl
} from '../../../lib/activitypub/url'
import {
  MStreamingPlaylistRedundanciesOpt,
  MVideo,
  MVideoAP,
  MVideoFile,
  MVideoFormattable,
  MVideoFormattableDetails
} from '../../../types/models'
import { MVideoFileRedundanciesOpt } from '../../../types/models/video/video-file'
import { VideoCaptionModel } from '../video-caption'

export type VideoFormattingJSONOptions = {
  completeDescription?: boolean
  additionalAttributes: {
    state?: boolean
    waitTranscoding?: boolean
    scheduledUpdate?: boolean
    blacklistInfo?: boolean
  }
}

function videoModelToFormattedJSON (video: MVideoFormattable, options?: VideoFormattingJSONOptions): Video {
  const userHistory = isArray(video.UserVideoHistories) ? video.UserVideoHistories[0] : undefined

  const videoObject: Video = {
    id: video.id,
    uuid: video.uuid,
    shortUUID: uuidToShort(video.uuid),

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

    description: options && options.completeDescription === true
      ? video.description
      : video.getTruncatedDescription(),

    isLocal: video.isOwned(),
    duration: video.duration,
    views: video.views,
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
    pluginData: (video as any).pluginData
  }

  if (options) {
    if (options.additionalAttributes.state === true) {
      videoObject.state = {
        id: video.state,
        label: getStateLabel(video.state)
      }
    }

    if (options.additionalAttributes.waitTranscoding === true) {
      videoObject.waitTranscoding = video.waitTranscoding
    }

    if (options.additionalAttributes.scheduledUpdate === true && video.ScheduleVideoUpdate) {
      videoObject.scheduledUpdate = {
        updateAt: video.ScheduleVideoUpdate.updateAt,
        privacy: video.ScheduleVideoUpdate.privacy || undefined
      }
    }

    if (options.additionalAttributes.blacklistInfo === true) {
      videoObject.blacklisted = !!video.VideoBlacklist
      videoObject.blacklistedReason = video.VideoBlacklist ? video.VideoBlacklist.reason : null
    }
  }

  return videoObject
}

function videoModelToFormattedDetailsJSON (video: MVideoFormattableDetails): VideoDetails {
  const formattedJson = video.toFormattedJSON({
    additionalAttributes: {
      scheduledUpdate: true,
      blacklistInfo: true
    }
  })

  const tags = video.Tags ? video.Tags.map(t => t.name) : []

  const streamingPlaylists = streamingPlaylistsModelToFormattedJSON(video, video.VideoStreamingPlaylists)

  const detailsJson = {
    support: video.support,
    descriptionPath: video.getDescriptionAPIPath(),
    channel: video.VideoChannel.toFormattedJSON(),
    account: video.VideoChannel.Account.toFormattedJSON(),
    tags,
    commentsEnabled: video.commentsEnabled,
    downloadEnabled: video.downloadEnabled,
    waitTranscoding: video.waitTranscoding,
    state: {
      id: video.state,
      label: getStateLabel(video.state)
    },

    trackerUrls: video.getTrackerUrls(),

    files: [],
    streamingPlaylists
  }

  // Format and sort video files
  detailsJson.files = videoFilesModelToFormattedJSON(video, video.VideoFiles)

  return Object.assign(formattedJson, detailsJson)
}

function streamingPlaylistsModelToFormattedJSON (
  video: MVideoFormattableDetails,
  playlists: MStreamingPlaylistRedundanciesOpt[]
): VideoStreamingPlaylist[] {
  if (isArray(playlists) === false) return []

  return playlists
    .map(playlist => {
      const redundancies = isArray(playlist.RedundancyVideos)
        ? playlist.RedundancyVideos.map(r => ({ baseUrl: r.fileUrl }))
        : []

      const files = videoFilesModelToFormattedJSON(video, playlist.VideoFiles)

      return {
        id: playlist.id,
        type: playlist.type,
        playlistUrl: playlist.playlistUrl,
        segmentsSha256Url: playlist.segmentsSha256Url,
        redundancies,
        files
      }
    })
}

function sortByResolutionDesc (fileA: MVideoFile, fileB: MVideoFile) {
  if (fileA.resolution < fileB.resolution) return 1
  if (fileA.resolution === fileB.resolution) return 0
  return -1
}

function videoFilesModelToFormattedJSON (
  video: MVideoFormattableDetails,
  videoFiles: MVideoFileRedundanciesOpt[],
  includeMagnet = true
): VideoFile[] {
  const trackerUrls = includeMagnet
    ? video.getTrackerUrls()
    : []

  return [ ...videoFiles ]
    .filter(f => !f.isLive())
    .sort(sortByResolutionDesc)
    .map(videoFile => {
      return {
        resolution: {
          id: videoFile.resolution,
          label: videoFile.resolution === 0 ? 'Audio' : `${videoFile.resolution}p`
        },

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
      } as VideoFile
    })
}

function addVideoFilesInAPAcc (
  acc: ActivityUrlObject[] | ActivityTagObject[],
  video: MVideo,
  files: MVideoFile[]
) {
  const trackerUrls = video.getTrackerUrls()

  const sortedFiles = [ ...files ]
    .filter(f => !f.isLive())
    .sort(sortByResolutionDesc)

  for (const file of sortedFiles) {
    acc.push({
      type: 'Link',
      mediaType: MIMETYPES.VIDEO.EXT_MIMETYPE[file.extname] as any,
      href: file.getFileUrl(video),
      height: file.resolution,
      size: file.size,
      fps: file.fps
    })

    acc.push({
      type: 'Link',
      rel: [ 'metadata', MIMETYPES.VIDEO.EXT_MIMETYPE[file.extname] ],
      mediaType: 'application/json' as 'application/json',
      href: getLocalVideoFileMetadataUrl(video, file),
      height: file.resolution,
      fps: file.fps
    })

    if (file.hasTorrent()) {
      acc.push({
        type: 'Link',
        mediaType: 'application/x-bittorrent' as 'application/x-bittorrent',
        href: file.getTorrentUrl(),
        height: file.resolution
      })

      acc.push({
        type: 'Link',
        mediaType: 'application/x-bittorrent;x-scheme-handler/magnet' as 'application/x-bittorrent;x-scheme-handler/magnet',
        href: generateMagnetUri(video, file, trackerUrls),
        height: file.resolution
      })
    }
  }
}

function videoModelToActivityPubObject (video: MVideoAP): VideoObject {
  if (!video.Tags) video.Tags = []

  const tag = video.Tags.map(t => ({
    type: 'Hashtag' as 'Hashtag',
    name: t.name
  }))

  let language
  if (video.language) {
    language = {
      identifier: video.language,
      name: getLanguageLabel(video.language)
    }
  }

  let category
  if (video.category) {
    category = {
      identifier: video.category + '',
      name: getCategoryLabel(video.category)
    }
  }

  let licence
  if (video.licence) {
    licence = {
      identifier: video.licence + '',
      name: getLicenceLabel(video.licence)
    }
  }

  const url: ActivityUrlObject[] = [
    // HTML url should be the first element in the array so Mastodon correctly displays the embed
    {
      type: 'Link',
      mediaType: 'text/html',
      href: WEBSERVER.URL + '/videos/watch/' + video.uuid
    }
  ]

  addVideoFilesInAPAcc(url, video, video.VideoFiles || [])

  for (const playlist of (video.VideoStreamingPlaylists || [])) {
    const tag = playlist.p2pMediaLoaderInfohashes
                  .map(i => ({ type: 'Infohash' as 'Infohash', name: i })) as ActivityTagObject[]
    tag.push({
      type: 'Link',
      name: 'sha256',
      mediaType: 'application/json' as 'application/json',
      href: playlist.segmentsSha256Url
    })

    addVideoFilesInAPAcc(tag, video, playlist.VideoFiles || [])

    url.push({
      type: 'Link',
      mediaType: 'application/x-mpegURL' as 'application/x-mpegURL',
      href: playlist.playlistUrl,
      tag
    })
  }

  for (const trackerUrl of video.getTrackerUrls()) {
    const rel2 = trackerUrl.startsWith('http')
      ? 'http'
      : 'websocket'

    url.push({
      type: 'Link',
      name: `tracker-${rel2}`,
      rel: [ 'tracker', rel2 ],
      href: trackerUrl
    })
  }

  const subtitleLanguage = []
  for (const caption of video.VideoCaptions) {
    subtitleLanguage.push({
      identifier: caption.language,
      name: VideoCaptionModel.getLanguageLabel(caption.language),
      url: caption.getFileUrl(video)
    })
  }

  const icons = [ video.getMiniature(), video.getPreview() ]

  return {
    type: 'Video' as 'Video',
    id: video.url,
    name: video.name,
    duration: getActivityStreamDuration(video.duration),
    uuid: video.uuid,
    tag,
    category,
    licence,
    language,
    views: video.views,
    sensitive: video.nsfw,
    waitTranscoding: video.waitTranscoding,
    isLiveBroadcast: video.isLive,

    liveSaveReplay: video.isLive
      ? video.VideoLive.saveReplay
      : null,

    permanentLive: video.isLive
      ? video.VideoLive.permanentLive
      : null,

    state: video.state,
    commentsEnabled: video.commentsEnabled,
    downloadEnabled: video.downloadEnabled,
    published: video.publishedAt.toISOString(),

    originallyPublishedAt: video.originallyPublishedAt
      ? video.originallyPublishedAt.toISOString()
      : null,

    updated: video.updatedAt.toISOString(),
    mediaType: 'text/markdown',
    content: video.description,
    support: video.support,
    subtitleLanguage,
    icon: icons.map(i => ({
      type: 'Image',
      url: i.getFileUrl(video),
      mediaType: 'image/jpeg',
      width: i.width,
      height: i.height
    })),
    url,
    likes: getLocalVideoLikesActivityPubUrl(video),
    dislikes: getLocalVideoDislikesActivityPubUrl(video),
    shares: getLocalVideoSharesActivityPubUrl(video),
    comments: getLocalVideoCommentsActivityPubUrl(video),
    attributedTo: [
      {
        type: 'Person',
        id: video.VideoChannel.Account.Actor.url
      },
      {
        type: 'Group',
        id: video.VideoChannel.Actor.url
      }
    ]
  }
}

function getActivityStreamDuration (duration: number) {
  // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
  return 'PT' + duration + 'S'
}

function getCategoryLabel (id: number) {
  return VIDEO_CATEGORIES[id] || 'Misc'
}

function getLicenceLabel (id: number) {
  return VIDEO_LICENCES[id] || 'Unknown'
}

function getLanguageLabel (id: string) {
  return VIDEO_LANGUAGES[id] || 'Unknown'
}

function getPrivacyLabel (id: number) {
  return VIDEO_PRIVACIES[id] || 'Unknown'
}

function getStateLabel (id: number) {
  return VIDEO_STATES[id] || 'Unknown'
}

export {
  videoModelToFormattedJSON,
  videoModelToFormattedDetailsJSON,
  videoFilesModelToFormattedJSON,
  videoModelToActivityPubObject,
  getActivityStreamDuration,

  getCategoryLabel,
  getLicenceLabel,
  getLanguageLabel,
  getPrivacyLabel,
  getStateLabel
}
