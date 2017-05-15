import { has, values } from 'lodash'

import {
  REQUEST_ENDPOINTS,
  REQUEST_ENDPOINT_ACTIONS,
  REQUEST_VIDEO_EVENT_TYPES
} from '../../../initializers'
import { isArray } from '../misc'
import {
  isVideoAuthorValid,
  isVideoThumbnailDataValid,
  isVideoRemoteIdValid,
  isVideoAbuseReasonValid,
  isVideoAbuseReporterUsernameValid,
  isVideoViewsValid,
  isVideoLikesValid,
  isVideoDislikesValid,
  isVideoEventCountValid,
  isVideoDateValid,
  isVideoCategoryValid,
  isVideoLicenceValid,
  isVideoLanguageValid,
  isVideoNSFWValid,
  isVideoDescriptionValid,
  isVideoDurationValid,
  isVideoInfoHashValid,
  isVideoNameValid,
  isVideoTagsValid,
  isVideoExtnameValid
} from '../videos'

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

function isEachRemoteRequestVideosValid (requests) {
  return isArray(requests) &&
    requests.every(function (request) {
      const video = request.data

      if (!video) return false

      return (
        isRequestTypeAddValid(request.type) &&
        isCommonVideoAttributesValid(video) &&
        isVideoAuthorValid(video.author) &&
        isVideoThumbnailDataValid(video.thumbnailData)
      ) ||
      (
        isRequestTypeUpdateValid(request.type) &&
        isCommonVideoAttributesValid(video)
      ) ||
      (
        isRequestTypeRemoveValid(request.type) &&
        isVideoRemoteIdValid(video.remoteId)
      ) ||
      (
        isRequestTypeReportAbuseValid(request.type) &&
        isVideoRemoteIdValid(request.data.videoRemoteId) &&
        isVideoAbuseReasonValid(request.data.reportReason) &&
        isVideoAbuseReporterUsernameValid(request.data.reporterUsername)
      )
    })
}

function isEachRemoteRequestVideosQaduValid (requests) {
  return isArray(requests) &&
    requests.every(function (request) {
      const video = request.data

      if (!video) return false

      return (
        isVideoRemoteIdValid(video.remoteId) &&
        (has(video, 'views') === false || isVideoViewsValid) &&
        (has(video, 'likes') === false || isVideoLikesValid) &&
        (has(video, 'dislikes') === false || isVideoDislikesValid)
      )
    })
}

function isEachRemoteRequestVideosEventsValid (requests) {
  return isArray(requests) &&
    requests.every(function (request) {
      const eventData = request.data

      if (!eventData) return false

      return (
        isVideoRemoteIdValid(eventData.remoteId) &&
        values(REQUEST_VIDEO_EVENT_TYPES).indexOf(eventData.eventType) !== -1 &&
        isVideoEventCountValid(eventData.count)
      )
    })
}

// ---------------------------------------------------------------------------

export {
  isEachRemoteRequestVideosValid,
  isEachRemoteRequestVideosQaduValid,
  isEachRemoteRequestVideosEventsValid
}

// ---------------------------------------------------------------------------

function isCommonVideoAttributesValid (video) {
  return isVideoDateValid(video.createdAt) &&
         isVideoDateValid(video.updatedAt) &&
         isVideoCategoryValid(video.category) &&
         isVideoLicenceValid(video.licence) &&
         isVideoLanguageValid(video.language) &&
         isVideoNSFWValid(video.nsfw) &&
         isVideoDescriptionValid(video.description) &&
         isVideoDurationValid(video.duration) &&
         isVideoInfoHashValid(video.infoHash) &&
         isVideoNameValid(video.name) &&
         isVideoTagsValid(video.tags) &&
         isVideoRemoteIdValid(video.remoteId) &&
         isVideoExtnameValid(video.extname) &&
         isVideoViewsValid(video.views) &&
         isVideoLikesValid(video.likes) &&
         isVideoDislikesValid(video.dislikes)
}

function isRequestTypeAddValid (value) {
  return value === ENDPOINT_ACTIONS.ADD
}

function isRequestTypeUpdateValid (value) {
  return value === ENDPOINT_ACTIONS.UPDATE
}

function isRequestTypeRemoveValid (value) {
  return value === ENDPOINT_ACTIONS.REMOVE
}

function isRequestTypeReportAbuseValid (value) {
  return value === ENDPOINT_ACTIONS.REPORT_ABUSE
}
