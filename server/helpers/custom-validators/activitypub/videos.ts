import * as validator from 'validator'

import {
  ACTIVITY_PUB
} from '../../../initializers'
import { isDateValid, isUUIDValid } from '../misc'
import {
  isVideoViewsValid,
  isVideoNSFWValid,
  isVideoTruncatedDescriptionValid,
  isVideoDurationValid,
  isVideoNameValid,
  isVideoTagValid,
  isVideoUrlValid
} from '../videos'
import { isVideoChannelDescriptionValid, isVideoChannelNameValid } from '../video-channels'
import { isBaseActivityValid } from './misc'

function isVideoTorrentAddActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Add') &&
    isVideoTorrentObjectValid(activity.object)
}

function isVideoTorrentUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isVideoTorrentObjectValid(activity.object)
}

function isVideoTorrentObjectValid (video: any) {
  return video.type === 'Video' &&
    isVideoNameValid(video.name) &&
    isVideoDurationValid(video.duration) &&
    isUUIDValid(video.uuid) &&
    setValidRemoteTags(video) &&
    isRemoteIdentifierValid(video.category) &&
    isRemoteIdentifierValid(video.licence) &&
    isRemoteIdentifierValid(video.language) &&
    isVideoViewsValid(video.video) &&
    isVideoNSFWValid(video.nsfw) &&
    isDateValid(video.published) &&
    isDateValid(video.updated) &&
    isRemoteVideoContentValid(video.mediaType, video.content) &&
    isRemoteVideoIconValid(video.icon) &&
    setValidRemoteVideoUrls(video.url)
}

function isVideoChannelCreateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Create') &&
    isVideoChannelObjectValid(activity.object)
}

function isVideoChannelUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isVideoChannelObjectValid(activity.object)
}

function isVideoChannelObjectValid (videoChannel: any) {
  return videoChannel.type === 'VideoChannel' &&
    isVideoChannelNameValid(videoChannel.name) &&
    isVideoChannelDescriptionValid(videoChannel.description) &&
    isUUIDValid(videoChannel.uuid)
}

// ---------------------------------------------------------------------------

export {
  isVideoTorrentAddActivityValid,
  isVideoChannelCreateActivityValid,
  isVideoTorrentUpdateActivityValid,
  isVideoChannelUpdateActivityValid
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
    validator.isInt(icon.width, { min: 0 }) &&
    validator.isInt(icon.height, { min: 0 })
}

function setValidRemoteVideoUrls (video: any) {
  if (Array.isArray(video.url) === false) return false

  const newUrl = video.url.filter(u => isRemoteVideoUrlValid(u))
  video.url = newUrl

  return true
}

function isRemoteVideoUrlValid (url: any) {
  return url.type === 'Link' &&
    ACTIVITY_PUB.VIDEO_URL_MIME_TYPES.indexOf(url.mimeType) !== -1 &&
    isVideoUrlValid(url.url) &&
    validator.isInt(url.width, { min: 0 }) &&
    validator.isInt(url.size, { min: 0 })
}
