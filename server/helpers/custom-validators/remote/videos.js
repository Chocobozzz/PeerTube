'use strict'

const has = require('lodash/has')
const values = require('lodash/values')

const constants = require('../../../initializers/constants')
const videosValidators = require('../videos')
const miscValidators = require('../misc')

const ENDPOINT_ACTIONS = constants.REQUEST_ENDPOINT_ACTIONS[constants.REQUEST_ENDPOINTS.VIDEOS]

const remoteVideosValidators = {
  isEachRemoteRequestVideosValid,
  isEachRemoteRequestVideosQaduValid,
  isEachRemoteRequestVideosEventsValid
}

function isEachRemoteRequestVideosValid (requests) {
  return miscValidators.isArray(requests) &&
    requests.every(function (request) {
      const video = request.data

      if (!video) return false

      return (
        isRequestTypeAddValid(request.type) &&
        isCommonVideoAttributesValid(video) &&
        videosValidators.isVideoAuthorValid(video.author) &&
        videosValidators.isVideoThumbnailDataValid(video.thumbnailData)
      ) ||
      (
        isRequestTypeUpdateValid(request.type) &&
        isCommonVideoAttributesValid(video)
      ) ||
      (
        isRequestTypeRemoveValid(request.type) &&
        videosValidators.isVideoRemoteIdValid(video.remoteId)
      ) ||
      (
        isRequestTypeReportAbuseValid(request.type) &&
        videosValidators.isVideoRemoteIdValid(request.data.videoRemoteId) &&
        videosValidators.isVideoAbuseReasonValid(request.data.reportReason) &&
        videosValidators.isVideoAbuseReporterUsernameValid(request.data.reporterUsername)
      )
    })
}

function isEachRemoteRequestVideosQaduValid (requests) {
  return miscValidators.isArray(requests) &&
    requests.every(function (request) {
      const video = request.data

      if (!video) return false

      return (
        videosValidators.isVideoRemoteIdValid(video.remoteId) &&
        (has(video, 'views') === false || videosValidators.isVideoViewsValid) &&
        (has(video, 'likes') === false || videosValidators.isVideoLikesValid) &&
        (has(video, 'dislikes') === false || videosValidators.isVideoDislikesValid)
      )
    })
}

function isEachRemoteRequestVideosEventsValid (requests) {
  return miscValidators.isArray(requests) &&
    requests.every(function (request) {
      const eventData = request.data

      if (!eventData) return false

      return (
        videosValidators.isVideoRemoteIdValid(eventData.remoteId) &&
        values(constants.REQUEST_VIDEO_EVENT_TYPES).indexOf(eventData.eventType) !== -1 &&
        videosValidators.isVideoEventCountValid(eventData.count)
      )
    })
}

// ---------------------------------------------------------------------------

module.exports = remoteVideosValidators

// ---------------------------------------------------------------------------

function isCommonVideoAttributesValid (video) {
  return videosValidators.isVideoDateValid(video.createdAt) &&
         videosValidators.isVideoDateValid(video.updatedAt) &&
         videosValidators.isVideoCategoryValid(video.category) &&
         videosValidators.isVideoLicenceValid(video.licence) &&
         videosValidators.isVideoDescriptionValid(video.description) &&
         videosValidators.isVideoDurationValid(video.duration) &&
         videosValidators.isVideoInfoHashValid(video.infoHash) &&
         videosValidators.isVideoNameValid(video.name) &&
         videosValidators.isVideoTagsValid(video.tags) &&
         videosValidators.isVideoRemoteIdValid(video.remoteId) &&
         videosValidators.isVideoExtnameValid(video.extname) &&
         videosValidators.isVideoViewsValid(video.views) &&
         videosValidators.isVideoLikesValid(video.likes) &&
         videosValidators.isVideoDislikesValid(video.dislikes)
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
