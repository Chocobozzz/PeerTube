import * as validator from 'validator'
import { ACTIVITY_PUB, CONSTRAINTS_FIELDS } from '../../../initializers'
import { peertubeTruncate } from '../../core-utils'
import { exists, isBooleanValid, isDateValid, isUUIDValid } from '../misc'
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
import { isVideoAbuseReasonValid } from '../video-abuses'

function sanitizeAndCheckVideoTorrentCreateActivity (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    sanitizeAndCheckVideoTorrentObject(activity.object)
}

function sanitizeAndCheckVideoTorrentUpdateActivity (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    sanitizeAndCheckVideoTorrentObject(activity.object)
}

function isVideoTorrentDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

function isVideoFlagValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    activity.object.type === 'Flag' &&
    isVideoAbuseReasonValid(activity.object.content) &&
    isActivityPubUrlValid(activity.object.object)
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

  if (!setValidRemoteTags(video)) return false
  if (!setValidRemoteVideoUrls(video)) return false
  if (!setRemoteVideoTruncatedContent(video)) return false
  if (!setValidAttributedTo(video)) return false
  if (!setValidRemoteCaptions(video)) return false

  // Default attributes
  if (!isVideoStateValid(video.state)) video.state = VideoState.PUBLISHED
  if (!isBooleanValid(video.waitTranscoding)) video.waitTranscoding = false

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
    isDateValid(video.published) &&
    isDateValid(video.updated) &&
    (!video.content || isRemoteVideoContentValid(video.mediaType, video.content)) &&
    isRemoteVideoIconValid(video.icon) &&
    video.url.length !== 0 &&
    video.attributedTo.length !== 0
}

// ---------------------------------------------------------------------------

export {
  sanitizeAndCheckVideoTorrentCreateActivity,
  sanitizeAndCheckVideoTorrentUpdateActivity,
  isVideoTorrentDeleteActivityValid,
  isRemoteStringIdentifierValid,
  isVideoFlagValid,
  sanitizeAndCheckVideoTorrentObject
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

function isRemoteVideoIconValid (icon: any) {
  return icon.type === 'Image' &&
    isActivityPubUrlValid(icon.url) &&
    icon.mediaType === 'image/jpeg' &&
    validator.isInt(icon.width + '', { min: 0 }) &&
    validator.isInt(icon.height + '', { min: 0 })
}

function setValidRemoteVideoUrls (video: any) {
  if (Array.isArray(video.url) === false) return false

  video.url = video.url.filter(u => isRemoteVideoUrlValid(u))

  return true
}

function setRemoteVideoTruncatedContent (video: any) {
  if (video.content) {
    video.content = peertubeTruncate(video.content, CONSTRAINTS_FIELDS.VIDEOS.TRUNCATED_DESCRIPTION.max)
  }

  return true
}

function isRemoteVideoUrlValid (url: any) {
  // FIXME: Old bug, we used the width to represent the resolution. Remove it in a few realease (currently beta.11)
  if (url.width && !url.height) url.height = url.width

  return url.type === 'Link' &&
    (
      ACTIVITY_PUB.URL_MIME_TYPES.VIDEO.indexOf(url.mimeType) !== -1 &&
      isActivityPubUrlValid(url.href) &&
      validator.isInt(url.height + '', { min: 0 }) &&
      validator.isInt(url.size + '', { min: 0 }) &&
      (!url.fps || validator.isInt(url.fps + '', { min: 0 }))
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.TORRENT.indexOf(url.mimeType) !== -1 &&
      isActivityPubUrlValid(url.href) &&
      validator.isInt(url.height + '', { min: 0 })
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.MAGNET.indexOf(url.mimeType) !== -1 &&
      validator.isLength(url.href, { min: 5 }) &&
      validator.isInt(url.height + '', { min: 0 })
    )
}
