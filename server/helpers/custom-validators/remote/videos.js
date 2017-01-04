'use strict'

const videosValidators = require('../videos')
const miscValidators = require('../misc')

const remoteVideosValidators = {
  isEachRemoteRequestVideosValid
}

function isEachRemoteRequestVideosValid (requests) {
  return miscValidators.isArray(requests) &&
    requests.every(function (request) {
      const video = request.data
      return (
        isRequestTypeAddValid(request.type) &&
        videosValidators.isVideoAuthorValid(video.author) &&
        videosValidators.isVideoDateValid(video.createdAt) &&
        videosValidators.isVideoDateValid(video.updatedAt) &&
        videosValidators.isVideoDescriptionValid(video.description) &&
        videosValidators.isVideoDurationValid(video.duration) &&
        videosValidators.isVideoInfoHashValid(video.infoHash) &&
        videosValidators.isVideoNameValid(video.name) &&
        videosValidators.isVideoTagsValid(video.tags) &&
        videosValidators.isVideoThumbnailDataValid(video.thumbnailData) &&
        videosValidators.isVideoRemoteIdValid(video.remoteId) &&
        videosValidators.isVideoExtnameValid(video.extname)
      ) ||
      (
        isRequestTypeUpdateValid(request.type) &&
        videosValidators.isVideoDateValid(video.createdAt) &&
        videosValidators.isVideoDateValid(video.updatedAt) &&
        videosValidators.isVideoDescriptionValid(video.description) &&
        videosValidators.isVideoDurationValid(video.duration) &&
        videosValidators.isVideoInfoHashValid(video.infoHash) &&
        videosValidators.isVideoNameValid(video.name) &&
        videosValidators.isVideoTagsValid(video.tags) &&
        videosValidators.isVideoRemoteIdValid(video.remoteId) &&
        videosValidators.isVideoExtnameValid(video.extname)
      ) ||
      (
        isRequestTypeRemoveValid(request.type) &&
        videosValidators.isVideoNameValid(video.name) &&
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

function isRequestTypeAddValid (value) {
  return value === 'add'
}

function isRequestTypeUpdateValid (value) {
  return value === 'update'
}

function isRequestTypeRemoveValid (value) {
  return value === 'remove'
}

function isRequestTypeReportAbuseValid (value) {
  return value === 'report-abuse'
}
