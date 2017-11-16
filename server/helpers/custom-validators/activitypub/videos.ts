import * as validator from 'validator'
import { ACTIVITY_PUB } from '../../../initializers'
import { exists, isDateValid, isUUIDValid } from '../misc'
import { isVideoChannelDescriptionValid, isVideoChannelNameValid } from '../video-channels'
import {
  isVideoAbuseReasonValid,
  isVideoDurationValid,
  isVideoNameValid,
  isVideoNSFWValid,
  isVideoTagValid,
  isVideoTruncatedDescriptionValid,
  isVideoUrlValid,
  isVideoViewsValid
} from '../videos'
import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isVideoTorrentAddActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Add') &&
    isVideoTorrentObjectValid(activity.object)
}

function isVideoTorrentUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isVideoTorrentObjectValid(activity.object)
}

function isVideoTorrentDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
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
    isRemoteIdentifierValid(video.category) &&
    isRemoteIdentifierValid(video.licence) &&
    isRemoteIdentifierValid(video.language) &&
    isVideoViewsValid(video.views) &&
    isVideoNSFWValid(video.nsfw) &&
    isDateValid(video.published) &&
    isDateValid(video.updated) &&
    isRemoteVideoContentValid(video.mediaType, video.content) &&
    isRemoteVideoIconValid(video.icon) &&
    setValidRemoteVideoUrls(video) &&
    video.url.length !== 0
}

function isVideoFlagValid (activity: any) {
  return isBaseActivityValid(activity, 'Flag') &&
    isVideoAbuseReasonValid(activity.content) &&
    isActivityPubUrlValid(activity.object)
}

function isAnnounceValid (activity: any) {
  return isBaseActivityValid(activity, 'Announce') &&
    (
      isVideoChannelCreateActivityValid(activity.object) ||
      isVideoTorrentAddActivityValid(activity.object)
    )
}

function isVideoChannelCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    isVideoChannelObjectValid(activity.object)
}

function isVideoChannelUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isVideoChannelObjectValid(activity.object)
}

function isVideoChannelDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

function isVideoChannelObjectValid (videoChannel: any) {
  return videoChannel.type === 'VideoChannel' &&
    isActivityPubUrlValid(videoChannel.id) &&
    isVideoChannelNameValid(videoChannel.name) &&
    isVideoChannelDescriptionValid(videoChannel.content) &&
    isDateValid(videoChannel.published) &&
    isDateValid(videoChannel.updated) &&
    isUUIDValid(videoChannel.uuid)
}

// ---------------------------------------------------------------------------

export {
  isVideoTorrentAddActivityValid,
  isVideoChannelCreateActivityValid,
  isVideoTorrentUpdateActivityValid,
  isVideoChannelUpdateActivityValid,
  isVideoChannelDeleteActivityValid,
  isVideoTorrentDeleteActivityValid,
  isVideoFlagValid,
  isAnnounceValid,
  isVideoChannelObjectValid
}

// ---------------------------------------------------------------------------

function setValidRemoteTags (video: any) {
  if (Array.isArray(video.tag) === false) return false

  const newTag = video.tag.filter(t => {
    return t.type === 'Hashtag' &&
      isVideoTagValid(t.name)
  })

  video.tag = newTag
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
    isVideoUrlValid(icon.url) &&
    icon.mediaType === 'image/jpeg' &&
    validator.isInt(icon.width + '', { min: 0 }) &&
    validator.isInt(icon.height + '', { min: 0 })
}

function setValidRemoteVideoUrls (video: any) {
  if (Array.isArray(video.url) === false) return false

  const newUrl = video.url.filter(u => isRemoteVideoUrlValid(u))
  video.url = newUrl

  return true
}

function isRemoteVideoUrlValid (url: any) {
  return url.type === 'Link' &&
    (
      ACTIVITY_PUB.URL_MIME_TYPES.VIDEO.indexOf(url.mimeType) !== -1 &&
      isVideoUrlValid(url.url) &&
      validator.isInt(url.width + '', { min: 0 }) &&
      validator.isInt(url.size + '', { min: 0 })
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.TORRENT.indexOf(url.mimeType) !== -1 &&
      isVideoUrlValid(url.url) &&
      validator.isInt(url.width + '', { min: 0 })
    ) ||
    (
      ACTIVITY_PUB.URL_MIME_TYPES.MAGNET.indexOf(url.mimeType) !== -1 &&
      validator.isLength(url.url, { min: 5 }) &&
      validator.isInt(url.width + '', { min: 0 })
    )
}
