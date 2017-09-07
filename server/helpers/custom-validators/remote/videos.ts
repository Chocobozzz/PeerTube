import 'express-validator'
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
  isVideoUUIDValid,
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
  isVideoFileInfoHashValid,
  isVideoNameValid,
  isVideoTagsValid,
  isVideoFileExtnameValid,
  isVideoFileResolutionValid
} from '../videos'

const ENDPOINT_ACTIONS = REQUEST_ENDPOINT_ACTIONS[REQUEST_ENDPOINTS.VIDEOS]

function isEachRemoteRequestVideosValid (requests: any[]) {
  return isArray(requests) &&
    requests.every(request => {
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
        isVideoUUIDValid(video.uuid)
      ) ||
      (
        isRequestTypeReportAbuseValid(request.type) &&
        isVideoUUIDValid(request.data.videoUUID) &&
        isVideoAbuseReasonValid(request.data.reportReason) &&
        isVideoAbuseReporterUsernameValid(request.data.reporterUsername)
      )
    })
}

function isEachRemoteRequestVideosQaduValid (requests: any[]) {
  return isArray(requests) &&
    requests.every(request => {
      const video = request.data

      if (!video) return false

      return (
        isVideoUUIDValid(video.uuid) &&
        (has(video, 'views') === false || isVideoViewsValid(video.views)) &&
        (has(video, 'likes') === false || isVideoLikesValid(video.likes)) &&
        (has(video, 'dislikes') === false || isVideoDislikesValid(video.dislikes))
      )
    })
}

function isEachRemoteRequestVideosEventsValid (requests: any[]) {
  return isArray(requests) &&
    requests.every(request => {
      const eventData = request.data

      if (!eventData) return false

      return (
        isVideoUUIDValid(eventData.uuid) &&
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

declare module 'express-validator' {
  export interface Validator {
    isEachRemoteRequestVideosValid,
    isEachRemoteRequestVideosQaduValid,
    isEachRemoteRequestVideosEventsValid
  }
}

// ---------------------------------------------------------------------------

function isCommonVideoAttributesValid (video: any) {
  return isVideoDateValid(video.createdAt) &&
         isVideoDateValid(video.updatedAt) &&
         isVideoCategoryValid(video.category) &&
         isVideoLicenceValid(video.licence) &&
         isVideoLanguageValid(video.language) &&
         isVideoNSFWValid(video.nsfw) &&
         isVideoDescriptionValid(video.description) &&
         isVideoDurationValid(video.duration) &&
         isVideoNameValid(video.name) &&
         isVideoTagsValid(video.tags) &&
         isVideoUUIDValid(video.uuid) &&
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

function isRequestTypeAddValid (value: string) {
  return value === ENDPOINT_ACTIONS.ADD
}

function isRequestTypeUpdateValid (value: string) {
  return value === ENDPOINT_ACTIONS.UPDATE
}

function isRequestTypeRemoveValid (value: string) {
  return value === ENDPOINT_ACTIONS.REMOVE
}

function isRequestTypeReportAbuseValid (value: string) {
  return value === ENDPOINT_ACTIONS.REPORT_ABUSE
}
