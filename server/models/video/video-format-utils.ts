import { Video, VideoDetails } from '../../../shared/models/videos'
import { VideoModel } from './video'
import { ActivityTagObject, ActivityUrlObject, VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { MIMETYPES, WEBSERVER } from '../../initializers/constants'
import { VideoCaptionModel } from './video-caption'
import {
  getVideoCommentsActivityPubUrl,
  getVideoDislikesActivityPubUrl,
  getVideoLikesActivityPubUrl,
  getVideoSharesActivityPubUrl
} from '../../lib/activitypub/url'
import { isArray } from '../../helpers/custom-validators/misc'
import { VideoStreamingPlaylist } from '../../../shared/models/videos/video-streaming-playlist.model'
import {
  MStreamingPlaylistRedundanciesOpt,
  MStreamingPlaylistVideo,
  MVideo,
  MVideoAP,
  MVideoFile,
  MVideoFormattable,
  MVideoFormattableDetails
} from '../../types/models'
import { MVideoFileRedundanciesOpt } from '../../types/models/video/video-file'
import { VideoFile } from '@shared/models/videos/video-file.model'
import { generateMagnetUri } from '@server/helpers/webtorrent'
import { extractVideo } from '@server/helpers/video'

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
    description: options && options.completeDescription === true ? video.description : video.getTruncatedDescription(),
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

    account: video.VideoChannel.Account.toFormattedSummaryJSON(),
    channel: video.VideoChannel.toFormattedSummaryJSON(),

    userHistory: userHistory ? {
      currentTime: userHistory.currentTime
    } : undefined
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
  detailsJson.files = videoFilesModelToFormattedJSON(video, baseUrlHttp, baseUrlWs, video.VideoFiles)

  return Object.assign(formattedJson, detailsJson)
}

function streamingPlaylistsModelToFormattedJSON (video: MVideo, playlists: MStreamingPlaylistRedundanciesOpt[]): VideoStreamingPlaylist[] {
  if (isArray(playlists) === false) return []

  const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()

  return playlists
    .map(playlist => {
      const playlistWithVideo = Object.assign(playlist, { Video: video })

      const redundancies = isArray(playlist.RedundancyVideos)
        ? playlist.RedundancyVideos.map(r => ({ baseUrl: r.fileUrl }))
        : []

      const files = videoFilesModelToFormattedJSON(playlistWithVideo, baseUrlHttp, baseUrlWs, playlist.VideoFiles)

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
  model: MVideo | MStreamingPlaylistVideo,
  baseUrlHttp: string,
  baseUrlWs: string,
  videoFiles: MVideoFileRedundanciesOpt[]
): VideoFile[] {
  const video = extractVideo(model)

  return [ ...videoFiles ]
    .sort(sortByResolutionDesc)
    .map(videoFile => {
      return {
        resolution: {
          id: videoFile.resolution,
          label: videoFile.resolution + 'p'
        },
        magnetUri: generateMagnetUri(model, videoFile, baseUrlHttp, baseUrlWs),
        size: videoFile.size,
        fps: videoFile.fps,
        torrentUrl: model.getTorrentUrl(videoFile, baseUrlHttp),
        torrentDownloadUrl: model.getTorrentDownloadUrl(videoFile, baseUrlHttp),
        fileUrl: model.getVideoFileUrl(videoFile, baseUrlHttp),
        fileDownloadUrl: model.getVideoFileDownloadUrl(videoFile, baseUrlHttp),
        metadataUrl: video.getVideoFileMetadataUrl(videoFile, baseUrlHttp)
      } as VideoFile
    })
}

function addVideoFilesInAPAcc (
  acc: ActivityUrlObject[] | ActivityTagObject[],
  model: MVideoAP | MStreamingPlaylistVideo,
  baseUrlHttp: string,
  baseUrlWs: string,
  files: MVideoFile[]
) {
  const sortedFiles = [ ...files ].sort(sortByResolutionDesc)

  for (const file of sortedFiles) {
    acc.push({
      type: 'Link',
      mediaType: MIMETYPES.VIDEO.EXT_MIMETYPE[file.extname] as any,
      href: model.getVideoFileUrl(file, baseUrlHttp),
      height: file.resolution,
      size: file.size,
      fps: file.fps
    })

    acc.push({
      type: 'Link',
      rel: [ 'metadata', MIMETYPES.VIDEO.EXT_MIMETYPE[file.extname] ],
      mediaType: 'application/json' as 'application/json',
      href: extractVideo(model).getVideoFileMetadataUrl(file, baseUrlHttp),
      height: file.resolution,
      fps: file.fps
    })

    acc.push({
      type: 'Link',
      mediaType: 'application/x-bittorrent' as 'application/x-bittorrent',
      href: model.getTorrentUrl(file, baseUrlHttp),
      height: file.resolution
    })

    acc.push({
      type: 'Link',
      mediaType: 'application/x-bittorrent;x-scheme-handler/magnet' as 'application/x-bittorrent;x-scheme-handler/magnet',
      href: generateMagnetUri(model, file, baseUrlHttp, baseUrlWs),
      height: file.resolution
    })
  }
}

function videoModelToActivityPubObject (video: MVideoAP): VideoTorrentObject {
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

  addVideoFilesInAPAcc(url, video, baseUrlHttp, baseUrlWs, video.VideoFiles || [])

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
    addVideoFilesInAPAcc(tag, playlistWithVideo, baseUrlHttp, baseUrlWs, playlist.VideoFiles || [])

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
    state: video.state,
    commentsEnabled: video.commentsEnabled,
    downloadEnabled: video.downloadEnabled,
    published: video.publishedAt.toISOString(),
    originallyPublishedAt: video.originallyPublishedAt ? video.originallyPublishedAt.toISOString() : null,
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
    likes: getVideoLikesActivityPubUrl(video),
    dislikes: getVideoDislikesActivityPubUrl(video),
    shares: getVideoSharesActivityPubUrl(video),
    comments: getVideoCommentsActivityPubUrl(video),
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
