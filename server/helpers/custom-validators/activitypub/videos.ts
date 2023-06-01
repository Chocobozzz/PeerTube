import validator from 'validator'
import { logger } from '@server/helpers/logger'
import { ActivityPubStoryboard, ActivityTrackerUrlObject, ActivityVideoFileMetadataUrlObject, VideoObject } from '@shared/models'
import { LiveVideoLatencyMode, VideoState } from '../../../../shared/models/videos'
import { ACTIVITY_PUB, CONSTRAINTS_FIELDS } from '../../../initializers/constants'
import { peertubeTruncate } from '../../core-utils'
import { isArray, isBooleanValid, isDateValid, isUUIDValid } from '../misc'
import { isLiveLatencyModeValid } from '../video-lives'
import {
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoNameValid,
  isVideoStateValid,
  isVideoTagValid,
  isVideoViewsValid
} from '../videos'
import { isActivityPubUrlValid, isActivityPubVideoDurationValid, isBaseActivityValid, setValidAttributedTo } from './misc'

function sanitizeAndCheckVideoTorrentUpdateActivity (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    sanitizeAndCheckVideoTorrentObject(activity.object)
}

function sanitizeAndCheckVideoTorrentObject (video: any) {
  if (!video || video.type !== 'Video') return false

  if (!setValidRemoteTags(video)) {
    logger.debug('Video has invalid tags', { video })
    return false
  }
  if (!setValidRemoteVideoUrls(video)) {
    logger.debug('Video has invalid urls', { video })
    return false
  }
  if (!setRemoteVideoContent(video)) {
    logger.debug('Video has invalid content', { video })
    return false
  }
  if (!setValidAttributedTo(video)) {
    logger.debug('Video has invalid attributedTo', { video })
    return false
  }
  if (!setValidRemoteCaptions(video)) {
    logger.debug('Video has invalid captions', { video })
    return false
  }
  if (!setValidRemoteIcon(video)) {
    logger.debug('Video has invalid icons', { video })
    return false
  }
  if (!setValidStoryboard(video)) {
    logger.debug('Video has invalid preview (storyboard)', { video })
    return false
  }

  // Default attributes
  if (!isVideoStateValid(video.state)) video.state = VideoState.PUBLISHED
  if (!isBooleanValid(video.waitTranscoding)) video.waitTranscoding = false
  if (!isBooleanValid(video.downloadEnabled)) video.downloadEnabled = true
  if (!isBooleanValid(video.commentsEnabled)) video.commentsEnabled = false
  if (!isBooleanValid(video.isLiveBroadcast)) video.isLiveBroadcast = false
  if (!isBooleanValid(video.liveSaveReplay)) video.liveSaveReplay = false
  if (!isBooleanValid(video.permanentLive)) video.permanentLive = false
  if (!isLiveLatencyModeValid(video.latencyMode)) video.latencyMode = LiveVideoLatencyMode.DEFAULT

  return isActivityPubUrlValid(video.id) &&
    isVideoNameValid(video.name) &&
    isActivityPubVideoDurationValid(video.duration) &&
    isVideoDurationValid(video.duration.replace(/[^0-9]+/g, '')) &&
    isUUIDValid(video.uuid) &&
    (!video.category || isRemoteNumberIdentifierValid(video.category)) &&
    (!video.licence || isRemoteNumberIdentifierValid(video.licence)) &&
    (!video.language || isRemoteStringIdentifierValid(video.language)) &&
    isVideoViewsValid(video.views) &&
    isBooleanValid(video.sensitive) &&
    isDateValid(video.published) &&
    isDateValid(video.updated) &&
    (!video.originallyPublishedAt || isDateValid(video.originallyPublishedAt)) &&
    (!video.content || isRemoteVideoContentValid(video.mediaType, video.content)) &&
    video.attributedTo.length !== 0
}

function isRemoteVideoUrlValid (url: any) {
  return url.type === 'Link' &&
    // Video file link
    (
      ACTIVITY_PUB.URL_MIME_TYPES.VIDEO.includes(url.mediaType) &&
      isActivityPubUrlValid(url.href) &&
      validator.isInt(url.height + '', { min: 0 }) &&
      validator.isInt(url.size + '', { min: 0 }) &&
      (!url.fps || validator.isInt(url.fps + '', { min: -1 }))
    ) ||
    // Torrent link
    (
      ACTIVITY_PUB.URL_MIME_TYPES.TORRENT.includes(url.mediaType) &&
      isActivityPubUrlValid(url.href) &&
      validator.isInt(url.height + '', { min: 0 })
    ) ||
    // Magnet link
    (
      ACTIVITY_PUB.URL_MIME_TYPES.MAGNET.includes(url.mediaType) &&
      validator.isLength(url.href, { min: 5 }) &&
      validator.isInt(url.height + '', { min: 0 })
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

function isAPVideoFileUrlMetadataObject (url: any): url is ActivityVideoFileMetadataUrlObject {
  return url &&
    url.type === 'Link' &&
    url.mediaType === 'application/json' &&
    isArray(url.rel) && url.rel.includes('metadata')
}

function isAPVideoTrackerUrlObject (url: any): url is ActivityTrackerUrlObject {
  return isArray(url.rel) &&
    url.rel.includes('tracker') &&
    isActivityPubUrlValid(url.href)
}

// ---------------------------------------------------------------------------

export {
  sanitizeAndCheckVideoTorrentUpdateActivity,
  isRemoteStringIdentifierValid,
  sanitizeAndCheckVideoTorrentObject,
  isRemoteVideoUrlValid,
  isAPVideoFileUrlMetadataObject,
  isAPVideoTrackerUrlObject
}

// ---------------------------------------------------------------------------

function setValidRemoteTags (video: any) {
  if (Array.isArray(video.tag) === false) return false

  video.tag = video.tag.filter(t => {
    return t.type === 'Hashtag' &&
      isVideoTagValid(t.name)
  })

  return true
}

function setValidRemoteCaptions (video: any) {
  if (!video.subtitleLanguage) video.subtitleLanguage = []

  if (Array.isArray(video.subtitleLanguage) === false) return false

  video.subtitleLanguage = video.subtitleLanguage.filter(caption => {
    if (!isActivityPubUrlValid(caption.url)) caption.url = null

    return isRemoteStringIdentifierValid(caption)
  })

  return true
}

function isRemoteNumberIdentifierValid (data: any) {
  return validator.isInt(data.identifier, { min: 0 })
}

function isRemoteStringIdentifierValid (data: any) {
  return typeof data.identifier === 'string'
}

function isRemoteVideoContentValid (mediaType: string, content: string) {
  return mediaType === 'text/markdown' && isVideoDescriptionValid(content)
}

function setValidRemoteIcon (video: any) {
  if (video.icon && !isArray(video.icon)) video.icon = [ video.icon ]
  if (!video.icon) video.icon = []

  video.icon = video.icon.filter(icon => {
    return icon.type === 'Image' &&
      isActivityPubUrlValid(icon.url) &&
      icon.mediaType === 'image/jpeg' &&
      validator.isInt(icon.width + '', { min: 0 }) &&
      validator.isInt(icon.height + '', { min: 0 })
  })

  return video.icon.length !== 0
}

function setValidRemoteVideoUrls (video: any) {
  if (Array.isArray(video.url) === false) return false

  video.url = video.url.filter(u => isRemoteVideoUrlValid(u))

  return true
}

function setRemoteVideoContent (video: any) {
  if (video.content) {
    video.content = peertubeTruncate(video.content, { length: CONSTRAINTS_FIELDS.VIDEOS.DESCRIPTION.max })
  }

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
      validator.isInt(u.width + '', { min: 0 }) &&
      validator.isInt(u.height + '', { min: 0 }) &&
      validator.isInt(u.tileWidth + '', { min: 0 }) &&
      validator.isInt(u.tileHeight + '', { min: 0 }) &&
      isActivityPubVideoDurationValid(u.tileDuration)
  })

  return preview.url.length !== 0
}
