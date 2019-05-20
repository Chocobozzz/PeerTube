import { Video, VideoDetails, VideoFile } from '../../../shared/models/videos'
import { VideoModel } from './video'
import { VideoFileModel } from './video-file'
import { ActivityUrlObject, VideoTorrentObject } from '../../../shared/models/activitypub/objects'
import { CONFIG, THUMBNAILS_SIZE, VIDEO_EXT_MIMETYPE } from '../../initializers'
import { VideoCaptionModel } from './video-caption'
import {
  getVideoCommentsActivityPubUrl,
  getVideoDislikesActivityPubUrl,
  getVideoLikesActivityPubUrl,
  getVideoSharesActivityPubUrl
} from '../../lib/activitypub'
import { isArray } from '../../helpers/custom-validators/misc'

export type VideoFormattingJSONOptions = {
  completeDescription?: boolean
  additionalAttributes: {
    state?: boolean,
    waitTranscoding?: boolean,
    scheduledUpdate?: boolean,
    blacklistInfo?: boolean
  }
}
function videoModelToFormattedJSON (video: VideoModel, options?: VideoFormattingJSONOptions): Video {
  const formattedAccount = video.VideoChannel.Account.toFormattedJSON()
  const formattedVideoChannel = video.VideoChannel.toFormattedJSON()

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
    articleid: video.articleid,
    thumbnailPath: video.getThumbnailStaticPath(),
    previewPath: video.getPreviewStaticPath(),
    embedPath: video.getEmbedStaticPath(),
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    publishedAt: video.publishedAt,
    account: {
      id: formattedAccount.id,
      uuid: formattedAccount.uuid,
      name: formattedAccount.name,
      displayName: formattedAccount.displayName,
      url: formattedAccount.url,
      host: formattedAccount.host,
      avatar: formattedAccount.avatar
    },
    channel: {
      id: formattedVideoChannel.id,
      uuid: formattedVideoChannel.uuid,
      name: formattedVideoChannel.name,
      displayName: formattedVideoChannel.displayName,
      url: formattedVideoChannel.url,
      host: formattedVideoChannel.host,
      avatar: formattedVideoChannel.avatar
    },

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

function videoModelToFormattedDetailsJSON (video: VideoModel): VideoDetails {
  const formattedJson = video.toFormattedJSON({
    additionalAttributes: {
      scheduledUpdate: true,
      blacklistInfo: true
    }
  })

  const tags = video.Tags ? video.Tags.map(t => t.name) : []
  const autors = video.Autors ? video.Autors.map(a => a.name) : []
  const detailsJson = {
    support: video.support,
    descriptionPath: video.getDescriptionAPIPath(),
    channel: video.VideoChannel.toFormattedJSON(),
    account: video.VideoChannel.Account.toFormattedJSON(),
    tags,
    autors,
    commentsEnabled: video.commentsEnabled,
    waitTranscoding: video.waitTranscoding,
    state: {
      id: video.state,
      label: VideoModel.getStateLabel(video.state)
    },
    files: []
  }

  // Format and sort video files
  detailsJson.files = videoFilesModelToFormattedJSON(video, video.VideoFiles)

  return Object.assign(formattedJson, detailsJson)
}

function videoFilesModelToFormattedJSON (video: VideoModel, videoFiles: VideoFileModel[]): VideoFile[] {
  const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()

  return videoFiles
    .map(videoFile => {
      let resolutionLabel = videoFile.resolution + 'p'

      return {
        resolution: {
          id: videoFile.resolution,
          label: resolutionLabel
        },
        magnetUri: video.generateMagnetUri(videoFile, baseUrlHttp, baseUrlWs),
        size: videoFile.size,
        fps: videoFile.fps,
        torrentUrl: video.getTorrentUrl(videoFile, baseUrlHttp),
        torrentDownloadUrl: video.getTorrentDownloadUrl(videoFile, baseUrlHttp),
        fileUrl: video.getVideoFileUrl(videoFile, baseUrlHttp),
        fileDownloadUrl: video.getVideoFileDownloadUrl(videoFile, baseUrlHttp)
      } as VideoFile
    })
    .sort((a, b) => {
      if (a.resolution.id < b.resolution.id) return 1
      if (a.resolution.id === b.resolution.id) return 0
      return -1
    })
}

function videoModelToActivityPubObject (video: VideoModel): VideoTorrentObject {
  const { baseUrlHttp, baseUrlWs } = video.getBaseUrls()
  if (!video.Tags) video.Tags = []

  const tag = video.Tags.map(t => ({
    type: 'Hashtag' as 'Hashtag',
    name: t.name
  }))
  if (!video.Autors) video.Autors = []

  const autor = video.Autors.map(a => ({
    type: 'Hashautor' as 'Hashautor',
    name: a.name
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

  const url: ActivityUrlObject[] = []
  for (const file of video.VideoFiles) {
    url.push({
      type: 'Link',
      mimeType: VIDEO_EXT_MIMETYPE[ file.extname ] as any,
      mediaType: VIDEO_EXT_MIMETYPE[ file.extname ] as any,
      href: video.getVideoFileUrl(file, baseUrlHttp),
      height: file.resolution,
      size: file.size,
      fps: file.fps
    })

    url.push({
      type: 'Link',
      mimeType: 'application/x-bittorrent' as 'application/x-bittorrent',
      mediaType: 'application/x-bittorrent' as 'application/x-bittorrent',
      href: video.getTorrentUrl(file, baseUrlHttp),
      height: file.resolution
    })

    url.push({
      type: 'Link',
      mimeType: 'application/x-bittorrent;x-scheme-handler/magnet' as 'application/x-bittorrent;x-scheme-handler/magnet',
      mediaType: 'application/x-bittorrent;x-scheme-handler/magnet' as 'application/x-bittorrent;x-scheme-handler/magnet',
      href: video.generateMagnetUri(file, baseUrlHttp, baseUrlWs),
      height: file.resolution
    })
  }

  // Add video url too
  url.push({
    type: 'Link',
    mimeType: 'text/html',
    mediaType: 'text/html',
    href: CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid
  })

  const subtitleLanguage = []
  for (const caption of video.VideoCaptions) {
    subtitleLanguage.push({
      identifier: caption.language,
      name: VideoCaptionModel.getLanguageLabel(caption.language)
    })
  }

  return {
    type: 'Video' as 'Video',
    id: video.url,
    name: video.name,
    duration: getActivityStreamDuration(video.duration),
    uuid: video.uuid,
    tag,
    autor,
    category,
    licence,
    language,
    views: video.views,
    sensitive: video.nsfw,
    waitTranscoding: video.waitTranscoding,
    state: video.state,
    commentsEnabled: video.commentsEnabled,
    published: video.publishedAt.toISOString(),
    updated: video.updatedAt.toISOString(),
    mediaType: 'text/markdown',
    content: video.getTruncatedDescription(),
    support: video.support,
    subtitleLanguage,
    icon: {
      type: 'Image',
      url: video.getThumbnailUrl(baseUrlHttp),
      mediaType: 'image/jpeg',
      width: THUMBNAILS_SIZE.width,
      height: THUMBNAILS_SIZE.height
    },
    url,
    likes: getVideoLikesActivityPubUrl(video),
    dislikes: getVideoDislikesActivityPubUrl(video),
    articleid: video.articleid,
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
