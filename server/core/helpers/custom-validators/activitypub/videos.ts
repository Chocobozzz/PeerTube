import {
  ActivityPubStoryboard,
  ActivityTrackerUrlObject,
  ActivityVideoFileMetadataUrlObject,
  LiveVideoLatencyMode,
  VideoCommentPolicy,
  VideoObject,
  VideoState
} from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { spdxToPeertubeLicence } from '@server/helpers/video.js'
import validator from 'validator'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '../../../initializers/constants.js'
import { peertubeTruncate } from '../../core-utils.js'
import { exists, isArray, isBooleanValid, isDateValid, isUUIDValid } from '../misc.js'
import { isLiveLatencyModeValid } from '../video-lives.js'
import {
  isVideoCommentsPolicyValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoNameValid,
  isVideoStateValid,
  isVideoTagValid,
  isVideoViewsValid
} from '../videos.js'
import { isActivityPubUrlValid, isActivityPubVideoDurationValid, isBaseActivityValid, setValidAttributedTo } from './misc.js'

export function sanitizeAndCheckVideoTorrentUpdateActivity (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    sanitizeAndCheckVideoTorrentObject(activity.object)
}

export function sanitizeAndCheckVideoTorrentObject (video: VideoObject) {
  if (!video || video.type !== 'Video') return false

  const fail = (field: string) => {
    logger.debug(`Video field is not valid to PeerTube: ${field}`, { video })
    return false
  }

  if (!setValidRemoteTags(video)) return fail('tags')
  if (!setValidRemoteVideoUrls(video)) return fail('urls')
  if (!setRemoteVideoContent(video)) return fail('content')
  if (!setValidAttributedTo(video)) return fail('attributedTo')
  if (!setValidRemoteCaptions(video)) return fail('captions')
  if (!setValidRemoteIcon(video)) return fail('icons')
  if (!setValidStoryboard(video)) return fail('preview (storyboard)')
  if (!setValidLicence(video)) return fail('licence')

  // TODO: compat with < 6.1, remove in 8.0
  if (!video.uuid && video['identifier']) video.uuid = video['identifier']

  // Default attributes
  if (!isVideoStateValid(video.state)) video.state = VideoState.PUBLISHED
  if (!isBooleanValid(video.waitTranscoding)) video.waitTranscoding = false
  if (!isBooleanValid(video.downloadEnabled)) video.downloadEnabled = true
  if (!isBooleanValid(video.isLiveBroadcast)) video.isLiveBroadcast = false
  if (!isBooleanValid(video.liveSaveReplay)) video.liveSaveReplay = false
  if (!isBooleanValid(video.permanentLive)) video.permanentLive = false
  if (!isBooleanValid(video.sensitive)) video.sensitive = false
  if (!isLiveLatencyModeValid(video.latencyMode)) video.latencyMode = LiveVideoLatencyMode.DEFAULT

  if (video.commentsPolicy) {
    if (!isVideoCommentsPolicyValid(video.commentsPolicy)) {
      video.commentsPolicy = VideoCommentPolicy.DISABLED
    }
  } else if (video.commentsEnabled === true) { // Fallback to deprecated attribute
    video.commentsPolicy = VideoCommentPolicy.ENABLED
  } else {
    video.commentsPolicy = VideoCommentPolicy.DISABLED
  }

  if (!isActivityPubUrlValid(video.id)) return fail('id')
  if (!isVideoNameValid(video.name)) return fail('name')

  if (!isActivityPubVideoDurationValid(video.duration)) return fail('duration format')
  if (!isVideoDurationValid(video.duration.replace(/[^0-9]+/g, ''))) return fail('duration')

  if (!isUUIDValid(video.uuid)) return fail('uuid')

  if (exists(video.category) && !isRemoteNumberIdentifierValid(video.category)) return fail('category')
  if (exists(video.language) && !isRemoteStringIdentifierValid(video.language)) return fail('language')

  if (!isVideoViewsValid(video.views)) return fail('views')
  if (!isDateValid(video.published)) return fail('published')
  if (!isDateValid(video.updated)) return fail('updated')

  if (exists(video.originallyPublishedAt) && !isDateValid(video.originallyPublishedAt)) return fail('originallyPublishedAt')
  if (exists(video.uploadDate) && !isDateValid(video.uploadDate)) return fail('uploadDate')
  if (exists(video.content) && !isRemoteVideoContentValid(video.mediaType, video.content)) return fail('mediaType/content')

  if (video.attributedTo.length === 0) return fail('attributedTo')

  return true
}

export function isRemoteVideoUrlValid (url: any) {
  return url.type === 'Link' &&
    // Video file link
    (
      MIMETYPES.AP_VIDEO.MIMETYPE_EXT[url.mediaType] &&
      isActivityPubUrlValid(url.href) &&
      validator.default.isInt(url.height + '', { min: 0 }) &&
      validator.default.isInt(url.size + '', { min: 0 }) &&
      (!url.fps || validator.default.isInt(url.fps + '', { min: -1 }))
    ) ||
    // Torrent link
    (
      MIMETYPES.AP_TORRENT.MIMETYPE_EXT[url.mediaType] &&
      isActivityPubUrlValid(url.href) &&
      validator.default.isInt(url.height + '', { min: 0 })
    ) ||
    // Magnet link
    (
      MIMETYPES.AP_MAGNET.MIMETYPE_EXT[url.mediaType] &&
      validator.default.isLength(url.href, { min: 5 }) &&
      validator.default.isInt(url.height + '', { min: 0 })
    ) ||
    // HLS playlist link
    (
      (url.mediaType || url.mimeType) === 'application/x-mpegURL' &&
      isActivityPubUrlValid(url.href) &&
      isArray(url.tag)
    ) ||
    isAPVideoTrackerUrlObject(url) ||
    isAPVideoFileUrlMetadataObject(url)
}

export function isAPVideoFileUrlMetadataObject (url: any): url is ActivityVideoFileMetadataUrlObject {
  return url &&
    url.type === 'Link' &&
    url.mediaType === 'application/json' &&
    isArray(url.rel) && url.rel.includes('metadata')
}

export function isAPVideoTrackerUrlObject (url: any): url is ActivityTrackerUrlObject {
  return isArray(url.rel) &&
    url.rel.includes('tracker') &&
    isActivityPubUrlValid(url.href)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function setValidRemoteTags (video: VideoObject) {
  if (Array.isArray(video.tag) === false) video.tag = []

  video.tag = video.tag.filter(t => t.type === 'Hashtag' && isVideoTagValid(t.name))

  return true
}

function setValidRemoteCaptions (video: VideoObject) {
  if (!video.subtitleLanguage) video.subtitleLanguage = []

  if (Array.isArray(video.subtitleLanguage) === false) return false

  video.subtitleLanguage = video.subtitleLanguage.filter(caption => {
    if (!isActivityPubUrlValid(caption.url)) caption.url = null

    return isRemoteStringIdentifierValid(caption)
  })

  return true
}

function isRemoteNumberIdentifierValid (data: any) {
  return validator.default.isInt(data.identifier, { min: 0 })
}

function isRemoteStringIdentifierValid (data: any) {
  return typeof data.identifier === 'string'
}

function isRemoteVideoContentValid (mediaType: string, content: string) {
  return (mediaType === 'text/markdown' || mediaType === 'text/html') && isVideoDescriptionValid(content)
}

function setValidRemoteIcon (video: any) {
  if (video.icon && !isArray(video.icon)) video.icon = [ video.icon ]
  if (!video.icon) video.icon = []

  video.icon = video.icon.filter(icon => {
    return icon.type === 'Image' &&
      isActivityPubUrlValid(icon.url) &&
      icon.mediaType === 'image/jpeg' &&
      validator.default.isInt(icon.width + '', { min: 0 }) &&
      validator.default.isInt(icon.height + '', { min: 0 })
  })

  return video.icon.length !== 0
}

function setValidRemoteVideoUrls (video: any) {
  if (Array.isArray(video.url) === false) return false

  video.url = video.url.filter(u => isRemoteVideoUrlValid(u))

  return true
}

function setRemoteVideoContent (video: VideoObject) {
  if (video.content) {
    video.content = peertubeTruncate(video.content, { length: CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max })
  }

  return true
}

function setValidLicence (video: VideoObject) {
  if (!exists(video.licence)) return true

  if (validator.default.isInt(video.licence.identifier)) return isRemoteNumberIdentifierValid(video.licence)

  const spdx = spdxToPeertubeLicence(video.licence.identifier)
  video.licence.identifier = spdx
    ? spdx + ''
    : undefined

  return true
}

function setValidStoryboard (video: VideoObject) {
  if (!video.preview) return true
  if (!Array.isArray(video.preview)) return false

  video.preview = video.preview.filter(p => isStorybordValid(p))

  return true
}

function isStorybordValid (preview: ActivityPubStoryboard) {
  if (!preview) return false

  if (
    preview.type !== 'Image' ||
    !isArray(preview.rel) ||
    !preview.rel.includes('storyboard')
  ) {
    return false
  }

  preview.url = preview.url.filter(u => {
    return u.mediaType === 'image/jpeg' &&
      isActivityPubUrlValid(u.href) &&
      validator.default.isInt(u.width + '', { min: 0 }) &&
      validator.default.isInt(u.height + '', { min: 0 }) &&
      validator.default.isInt(u.tileWidth + '', { min: 0 }) &&
      validator.default.isInt(u.tileHeight + '', { min: 0 }) &&
      isActivityPubVideoDurationValid(u.tileDuration)
  })

  return preview.url.length !== 0
}
