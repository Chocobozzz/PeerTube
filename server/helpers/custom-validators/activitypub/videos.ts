import validator from 'validator'
import { ACTIVITY_PUB, CONSTRAINTS_FIELDS } from '../../../initializers/constants'
import { peertubeTruncate } from '../../core-utils'
import { exists, isArray, isBooleanValid, isDateValid, isUUIDValid } from '../misc'
import {
  isVideoDurationValid,
  isVideoNameValid,
  isVideoStateValid,
  isVideoTagValid,
  isVideoTruncatedDescriptionValid,
  isVideoViewsValid
} from '../videos'
import { isActivityPubUrlValid, isBaseActivityValid, setValidAttributedTo } from './misc'
import { VideoState } from '../../../../shared/models/videos'
import { logger } from '@server/helpers/logger'
import { ActivityVideoFileMetadataObject } from '@shared/models'

function sanitizeAndCheckVideoTorrentUpdateActivity (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    sanitizeAndCheckVideoTorrentObject(activity.object)
}

function isActivityPubVideoDurationValid (value: string) {
  // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
  return exists(value) &&
    typeof value === 'string' &&
    value.startsWith('PT') &&
    value.endsWith('S') &&
    isVideoDurationValid(value.replace(/[^0-9]+/g, ''))
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
  if (!setRemoteVideoTruncatedContent(video)) {
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

  // Default attributes
  if (!isVideoStateValid(video.state)) video.state = VideoState.PUBLISHED
  if (!isBooleanValid(video.waitTranscoding)) video.waitTranscoding = false
  if (!isBooleanValid(video.downloadEnabled)) video.downloadEnabled = true
  if (!isBooleanValid(video.commentsEnabled)) video.commentsEnabled = false

  return isActivityPubUrlValid(video.id) &&
    isVideoNameValid(video.name) &&
    isActivityPubVideoDurationValid(video.duration) &&
    isUUIDValid(video.uuid) &&
    (!video.category || isRemoteNumberIdentifierValid(video.category)) &&
    (!video.licence || isRemoteNumberIdentifierValid(video.licence)) &&
    (!video.language || isRemoteStringIdentifierValid(video.language)) &&
    isVideoViewsValid(video.views) &&
    isBooleanValid(video.sensitive) &&
    isBooleanValid(video.commentsEnabled) &&
    isBooleanValid(video.downloadEnabled) &&
    isDateValid(video.published) &&
    isDateValid(video.updated) &&
    (!video.originallyPublishedAt || isDateValid(video.originallyPublishedAt)) &&
    (!video.content || isRemoteVideoContentValid(video.mediaType, video.content)) &&
    video.url.length !== 0 &&
    video.attributedTo.length !== 0
}

function isRemoteVideoUrlValid (url: any) {
  return url.type === 'Link' &&
    (
      ACTIVITY_PUB.URL_MIME_TYPES.VIDEO.includes(url.mediaType) &&
      isActivityPubUrlValid(url.href) &&
      validator.isInt(url.height + '', { min: 0 }) &&
      validator.isInt(url.size + '', { min: 0 }) &&
      (!url.fps || validator.isInt(url.fps + '', { min: -1 }))
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.TORRENT.includes(url.mediaType) &&
      isActivityPubUrlValid(url.href) &&
      validator.isInt(url.height + '', { min: 0 })
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.MAGNET.includes(url.mediaType) &&
      validator.isLength(url.href, { min: 5 }) &&
      validator.isInt(url.height + '', { min: 0 })
    ) ||
    (
      (url.mediaType || url.mimeType) === 'application/x-mpegURL' &&
      isActivityPubUrlValid(url.href) &&
      isArray(url.tag)
    ) ||
    isAPVideoFileMetadataObject(url)
}

function isAPVideoFileMetadataObject (url: any): url is ActivityVideoFileMetadataObject {
  return url &&
    url.type === 'Link' &&
    url.mediaType === 'application/json' &&
    isArray(url.rel) && url.rel.includes('metadata')
}

// ---------------------------------------------------------------------------

export {
  sanitizeAndCheckVideoTorrentUpdateActivity,
  isRemoteStringIdentifierValid,
  sanitizeAndCheckVideoTorrentObject,
  isRemoteVideoUrlValid,
  isAPVideoFileMetadataObject
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
  return mediaType === 'text/markdown' && isVideoTruncatedDescriptionValid(content)
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

function setRemoteVideoTruncatedContent (video: any) {
  if (video.content) {
    video.content = peertubeTruncate(video.content, { length: CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max })
  }

  return true
}
