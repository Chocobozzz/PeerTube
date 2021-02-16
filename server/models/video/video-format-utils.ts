import { generateMagnetUri } from '@server/helpers/webtorrent'
import { getLocalVideoFileMetadataUrl } from '@server/lib/video-paths'
import { VideoFile } from '@shared/models/videos/video-file.model'
import { ActivityTagObject, ActivityUrlObject, VideoObject } from '../../../shared/models/activitypub/objects'
import { Video, VideoDetails } from '../../../shared/models/videos'
import { VideoStreamingPlaylist } from '../../../shared/models/videos/video-streaming-playlist.model'
import { isArray } from '../../helpers/custom-validators/misc'
import { MIMETYPES, WEBSERVER } from '../../initializers/constants'
import {
  getLocalVideoCommentsActivityPubUrl,
  getLocalVideoDislikesActivityPubUrl,
  getLocalVideoLikesActivityPubUrl,
  getLocalVideoSharesActivityPubUrl
} from '../../lib/activitypub/url'
import {
  MStreamingPlaylistRedundanciesOpt,
  MStreamingPlaylistVideo,
  MVideo,
  MVideoAP,
  MVideoFile,
  MVideoFormattable,
  MVideoFormattableDetails,
  MVideoWithHost
} from '../../types/models'
import { MVideoFileRedundanciesOpt } from '../../types/models/video/video-file'
import { VideoModel } from './video'
import { VideoCaptionModel } from './video-caption'

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
    name: video.name,
    category: {
      id: video.category,
      label: VideoModel.getCategoryLabel(video.category)
    },
    licence: {
      id: video.licence,
      label: VideoModel.getLicenceLabel(video.licence)
    },
    language: {
      id: video.language,
      label: VideoModel.getLanguageLabel(video.language)
    },
    privacy: {
      id: video.privacy,
      label: VideoModel.getPrivacyLabel(video.privacy)
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
        label: VideoModel.getStateLabel(video.state)
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

  const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()

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
      label: VideoModel.getStateLabel(video.state)
    },

    trackerUrls: video.getTrackerUrls(baseUrlHttp, baseUrlWs),

    files: [],
    streamingPlaylists
  }

  // Format and sort video files
  detailsJson.files = videoFilesModelToFormattedJSON(video, video, baseUrlHttp, baseUrlWs, video.VideoFiles)

  return Object.assign(formattedJson, detailsJson)
}

function streamingPlaylistsModelToFormattedJSON (
  video: MVideoFormattableDetails,
  playlists: MStreamingPlaylistRedundanciesOpt[]
): VideoStreamingPlaylist[] {
  if (isArray(playlists) === false) return []

  const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()

  return playlists
    .map(playlist => {
      const playlistWithVideo = Object.assign(playlist, { Video: video })

      const redundancies = isArray(playlist.RedundancyVideos)
        ? playlist.RedundancyVideos.map(r => ({ baseUrl: r.fileUrl }))
        : []

      const files = videoFilesModelToFormattedJSON(playlistWithVideo, video, baseUrlHttp, baseUrlWs, playlist.VideoFiles)

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

// FIXME: refactor/merge model and video arguments
function videoFilesModelToFormattedJSON (
  model: MVideo | MStreamingPlaylistVideo,
  video: MVideoFormattableDetails,
  baseUrlHttp: string,
  baseUrlWs: string,
  videoFiles: MVideoFileRedundanciesOpt[]
): VideoFile[] {
  return [ ...videoFiles ]
    .filter(f => !f.isLive())
    .sort(sortByResolutionDesc)
    .map(videoFile => {
      return {
        resolution: {
          id: videoFile.resolution,
          label: videoFile.resolution + 'p'
        },

        // FIXME: deprecated in 3.2
        magnetUri: generateMagnetUri(model, video, videoFile, baseUrlHttp, baseUrlWs),

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

// FIXME: refactor/merge model and video arguments
function addVideoFilesInAPAcc (
  acc: ActivityUrlObject[] | ActivityTagObject[],
  model: MVideoAP | MStreamingPlaylistVideo,
  video: MVideoWithHost,
  baseUrlHttp: string,
  baseUrlWs: string,
  files: MVideoFile[]
) {
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

    acc.push({
      type: 'Link',
      mediaType: 'application/x-bittorrent' as 'application/x-bittorrent',
      href: file.getTorrentUrl(),
      height: file.resolution
    })

    acc.push({
      type: 'Link',
      mediaType: 'application/x-bittorrent;x-scheme-handler/magnet' as 'application/x-bittorrent;x-scheme-handler/magnet',
      href: generateMagnetUri(model, video, file, baseUrlHttp, baseUrlWs),
      height: file.resolution
    })
  }
}

function videoModelToActivityPubObject (video: MVideoAP): VideoObject {
  const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()
  if (!video.Tags) video.Tags = []

  const tag = video.Tags.map(t => ({
    type: 'Hashtag' as 'Hashtag',
    name: t.name
  }))

  let language
  if (video.language) {
    language = {
      identifier: video.language,
      name: VideoModel.getLanguageLabel(video.language)
    }
  }

  let category
  if (video.category) {
    category = {
      identifier: video.category + '',
      name: VideoModel.getCategoryLabel(video.category)
    }
  }

  let licence
  if (video.licence) {
    licence = {
      identifier: video.licence + '',
      name: VideoModel.getLicenceLabel(video.licence)
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

  addVideoFilesInAPAcc(url, video, video, baseUrlHttp, baseUrlWs, video.VideoFiles || [])

  for (const playlist of (video.VideoStreamingPlaylists || [])) {
    const tag = playlist.p2pMediaLoaderInfohashes
                  .map(i => ({ type: 'Infohash' as 'Infohash', name: i })) as ActivityTagObject[]
    tag.push({
      type: 'Link',
      name: 'sha256',
      mediaType: 'application/json' as 'application/json',
      href: playlist.segmentsSha256Url
    })

    const playlistWithVideo = Object.assign(playlist, { Video: video })
    addVideoFilesInAPAcc(tag, playlistWithVideo, video, baseUrlHttp, baseUrlWs, playlist.VideoFiles || [])

    url.push({
      type: 'Link',
      mediaType: 'application/x-mpegURL' as 'application/x-mpegURL',
      href: playlist.playlistUrl,
      tag
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

export {
  videoModelToFormattedJSON,
  videoModelToFormattedDetailsJSON,
  videoFilesModelToFormattedJSON,
  videoModelToActivityPubObject,
  getActivityStreamDuration
}
