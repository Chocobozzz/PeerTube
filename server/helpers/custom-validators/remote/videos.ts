import 'express-validator'
import { has, values } from 'lodash'

import {
  REQUEST_ENDPOINTS,
  REQUEST_ENDPOINT_ACTIONS,
  REQUEST_VIDEO_EVENT_TYPES
} from '../../../initializers'
import { isArray, isDateValid, isUUIDValid } from '../misc'
import {
  isVideoThumbnailDataValid,
  isVideoAbuseReasonValid,
  isVideoAbuseReporterUsernameValid,
  isVideoViewsValid,
  isVideoLikesValid,
  isVideoDislikesValid,
  isVideoEventCountValid,
  isRemoteVideoCategoryValid,
  isRemoteVideoLicenceValid,
  isRemoteVideoLanguageValid,
  isVideoNSFWValid,
  isVideoTruncatedDescriptionValid,
  isVideoDurationValid,
  isVideoFileInfoHashValid,
  isVideoNameValid,
  isVideoTagsValid,
  isVideoFileExtnameValid,
  isVideoFileResolutionValid
} from '../videos'
import { isVideoChannelDescriptionValid, isVideoChannelNameValid } from '../video-channels'
import { isVideoAuthorNameValid } from '../video-authors'

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

const checkers: { [ id: string ]: (obj: any) => boolean } = {}
checkers[ENDPOINT_ACTIONS.ADD_VIDEO] = checkAddVideo
checkers[ENDPOINT_ACTIONS.UPDATE_VIDEO] = checkUpdateVideo
checkers[ENDPOINT_ACTIONS.REMOVE_VIDEO] = checkRemoveVideo
checkers[ENDPOINT_ACTIONS.REPORT_ABUSE] = checkReportVideo
checkers[ENDPOINT_ACTIONS.ADD_CHANNEL] = checkAddVideoChannel
checkers[ENDPOINT_ACTIONS.UPDATE_CHANNEL] = checkUpdateVideoChannel
checkers[ENDPOINT_ACTIONS.REMOVE_CHANNEL] = checkRemoveVideoChannel
checkers[ENDPOINT_ACTIONS.ADD_AUTHOR] = checkAddAuthor
checkers[ENDPOINT_ACTIONS.REMOVE_AUTHOR] = checkRemoveAuthor

function removeBadRequestVideos (requests: any[]) {
  for (let i = requests.length - 1; i >= 0 ; i--) {
    const request = requests[i]
    const video = request.data

    if (
      !video ||
      checkers[request.type] === undefined ||
      checkers[request.type](video) === false
    ) {
      requests.splice(i, 1)
    }
  }
}

function removeBadRequestVideosQadu (requests: any[]) {
  for (let i = requests.length - 1; i >= 0 ; i--) {
    const request = requests[i]
    const video = request.data

    if (
      !video ||
      (
        isUUIDValid(video.uuid) &&
        (has(video, 'views') === false || isVideoViewsValid(video.views)) &&
        (has(video, 'likes') === false || isVideoLikesValid(video.likes)) &&
        (has(video, 'dislikes') === false || isVideoDislikesValid(video.dislikes))
      ) === false
    ) {
      requests.splice(i, 1)
    }
  }
}

function removeBadRequestVideosEvents (requests: any[]) {
  for (let i = requests.length - 1; i >= 0 ; i--) {
    const request = requests[i]
    const eventData = request.data

    if (
      !eventData ||
      (
        isUUIDValid(eventData.uuid) &&
        values(REQUEST_VIDEO_EVENT_TYPES).indexOf(eventData.eventType) !== -1 &&
        isVideoEventCountValid(eventData.count)
      ) === false
    ) {
      requests.splice(i, 1)
    }
  }
}

// ---------------------------------------------------------------------------

export {
  removeBadRequestVideos,
  removeBadRequestVideosQadu,
  removeBadRequestVideosEvents
}

// ---------------------------------------------------------------------------

function isCommonVideoAttributesValid (video: any) {
  return isDateValid(video.createdAt) &&
         isDateValid(video.updatedAt) &&
         isRemoteVideoCategoryValid(video.category) &&
         isRemoteVideoLicenceValid(video.licence) &&
         isRemoteVideoLanguageValid(video.language) &&
         isVideoNSFWValid(video.nsfw) &&
         isVideoTruncatedDescriptionValid(video.truncatedDescription) &&
         isVideoDurationValid(video.duration) &&
         isVideoNameValid(video.name) &&
         isVideoTagsValid(video.tags) &&
         isUUIDValid(video.uuid) &&
         isVideoViewsValid(video.views) &&
         isVideoLikesValid(video.likes) &&
         isVideoDislikesValid(video.dislikes) &&
         isArray(video.files) &&
         video.files.every(videoFile => {
           if (!videoFile) return false

           return (
             isVideoFileInfoHashValid(videoFile.infoHash) &&
             isVideoFileExtnameValid(videoFile.extname) &&
             isVideoFileResolutionValid(videoFile.resolution)
           )
         })
}

function checkAddVideo (video: any) {
  return isCommonVideoAttributesValid(video) &&
         isUUIDValid(video.channelUUID) &&
         isVideoThumbnailDataValid(video.thumbnailData)
}

function checkUpdateVideo (video: any) {
  return isCommonVideoAttributesValid(video)
}

function checkRemoveVideo (video: any) {
  return isUUIDValid(video.uuid)
}

function checkReportVideo (abuse: any) {
  return isUUIDValid(abuse.videoUUID) &&
         isVideoAbuseReasonValid(abuse.reportReason) &&
         isVideoAbuseReporterUsernameValid(abuse.reporterUsername)
}

function checkAddVideoChannel (videoChannel: any) {
  return isUUIDValid(videoChannel.uuid) &&
         isVideoChannelNameValid(videoChannel.name) &&
         isVideoChannelDescriptionValid(videoChannel.description) &&
         isDateValid(videoChannel.createdAt) &&
         isDateValid(videoChannel.updatedAt) &&
         isUUIDValid(videoChannel.ownerUUID)
}

function checkUpdateVideoChannel (videoChannel: any) {
  return isUUIDValid(videoChannel.uuid) &&
         isVideoChannelNameValid(videoChannel.name) &&
         isVideoChannelDescriptionValid(videoChannel.description) &&
         isDateValid(videoChannel.createdAt) &&
         isDateValid(videoChannel.updatedAt) &&
         isUUIDValid(videoChannel.ownerUUID)
}

function checkRemoveVideoChannel (videoChannel: any) {
  return isUUIDValid(videoChannel.uuid)
}

function checkAddAuthor (author: any) {
  return isUUIDValid(author.uuid) &&
         isVideoAuthorNameValid(author.name)
}

function checkRemoveAuthor (author: any) {
  return isUUIDValid(author.uuid)
}
