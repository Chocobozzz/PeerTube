'use strict'

const constants = require('../../../initializers/constants')
const videosValidators = require('../videos')
const miscValidators = require('../misc')

const ENDPOINT_ACTIONS = constants.REQUEST_ENDPOINT_ACTIONS[constants.REQUEST_ENDPOINTS.VIDEOS]

const remoteVideosValidators = {
  isEachRemoteRequestVideosValid
}

function isEachRemoteRequestVideosValid (requests) {
  return miscValidators.isArray(requests) &&
    requests.every(function (request) {
      const video = request.data
      return (
        isRequestTypeAddValid(request.type) &&
        isCommonVideoAttrbiutesValid(video) &&
        videosValidators.isVideoAuthorValid(video.author) &&
        videosValidators.isVideoThumbnailDataValid(video.thumbnailData)
      ) ||
      (
        isRequestTypeUpdateValid(request.type) &&
        isCommonVideoAttrbiutesValid(video)
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

// ---------------------------------------------------------------------------

module.exports = remoteVideosValidators

// ---------------------------------------------------------------------------

function isCommonVideoAttrbiutesValid (video) {
  return videosValidators.isVideoDateValid(video.createdAt) &&
         videosValidators.isVideoDateValid(video.updatedAt) &&
         videosValidators.isVideoDescriptionValid(video.description) &&
         videosValidators.isVideoDurationValid(video.duration) &&
         videosValidators.isVideoInfoHashValid(video.infoHash) &&
         videosValidators.isVideoNameValid(video.name) &&
         videosValidators.isVideoTagsValid(video.tags) &&
         videosValidators.isVideoRemoteIdValid(video.remoteId) &&
         videosValidators.isVideoExtnameValid(video.extname)
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
