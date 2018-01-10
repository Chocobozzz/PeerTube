import * as validator from 'validator'
import { ACTIVITY_PUB } from '../../../initializers'
import { exists, isBooleanValid, isDateValid, isUUIDValid } from '../misc'
import {
  isVideoAbuseReasonValid,
  isVideoDurationValid,
  isVideoNameValid,
  isVideoTagValid,
  isVideoTruncatedDescriptionValid,
  isVideoViewsValid
} from '../videos'
import { isActivityPubUrlValid, isBaseActivityValid, setValidAttributedTo } from './misc'

function isVideoTorrentCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    isVideoTorrentObjectValid(activity.object)
}

function isVideoTorrentUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isVideoTorrentObjectValid(activity.object)
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

function isVideoTorrentObjectValid (video: any) {
  return video.type === 'Video' &&
    isActivityPubUrlValid(video.id) &&
    isVideoNameValid(video.name) &&
    isActivityPubVideoDurationValid(video.duration) &&
    isUUIDValid(video.uuid) &&
    setValidRemoteTags(video) &&
    (!video.category || isRemoteIdentifierValid(video.category)) &&
    (!video.licence || isRemoteIdentifierValid(video.licence)) &&
    (!video.language || isRemoteIdentifierValid(video.language)) &&
    isVideoViewsValid(video.views) &&
    isBooleanValid(video.nsfw) &&
    isBooleanValid(video.commentsEnabled) &&
    isDateValid(video.published) &&
    isDateValid(video.updated) &&
    (!video.content || isRemoteVideoContentValid(video.mediaType, video.content)) &&
    isRemoteVideoIconValid(video.icon) &&
    setValidRemoteVideoUrls(video) &&
    video.url.length !== 0 &&
    setValidAttributedTo(video) &&
    video.attributedTo.length !== 0
}

// ---------------------------------------------------------------------------

export {
  isVideoTorrentCreateActivityValid,
  isVideoTorrentUpdateActivityValid,
  isVideoTorrentDeleteActivityValid,
  isVideoFlagValid,
  isVideoTorrentObjectValid
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

function isRemoteIdentifierValid (data: any) {
  return validator.isInt(data.identifier, { min: 0 })
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

function isRemoteVideoUrlValid (url: any) {
  return url.type === 'Link' &&
    (
      ACTIVITY_PUB.URL_MIME_TYPES.VIDEO.indexOf(url.mimeType) !== -1 &&
      isActivityPubUrlValid(url.url) &&
      validator.isInt(url.width + '', { min: 0 }) &&
      validator.isInt(url.size + '', { min: 0 })
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.TORRENT.indexOf(url.mimeType) !== -1 &&
      isActivityPubUrlValid(url.url) &&
      validator.isInt(url.width + '', { min: 0 })
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.MAGNET.indexOf(url.mimeType) !== -1 &&
      validator.isLength(url.url, { min: 5 }) &&
      validator.isInt(url.width + '', { min: 0 })
    )
}
