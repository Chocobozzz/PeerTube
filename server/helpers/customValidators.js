'use strict'

const validator = require('express-validator').validator

const constants = require('../initializers/constants')
const VIDEOS_CONSTRAINTS_FIELDS = constants.VIDEOS_CONSTRAINTS_FIELDS

const customValidators = {
  exists: exists,
  isEachAddRemoteVideosValid: isEachAddRemoteVideosValid,
  isEachRemoveRemoteVideosValid: isEachRemoveRemoteVideosValid,
  isArray: isArray,
  isVideoAuthorValid: isVideoAuthorValid,
  isVideoDateValid: isVideoDateValid,
  isVideoDescriptionValid: isVideoDescriptionValid,
  isVideoDurationValid: isVideoDurationValid,
  isVideoMagnetUriValid: isVideoMagnetUriValid,
  isVideoNameValid: isVideoNameValid,
  isVideoPodUrlValid: isVideoPodUrlValid,
  isVideoTagsValid: isVideoTagsValid,
  isVideoThumbnailValid: isVideoThumbnailValid
}

function exists (value) {
  return value !== undefined && value !== null
}

function isEachAddRemoteVideosValid (videos) {
  return videos.every(function (video) {
    return isVideoAuthorValid(video.author) &&
           isVideoDateValid(video.createdDate) &&
           isVideoDescriptionValid(video.description) &&
           isVideoDurationValid(video.duration) &&
           isVideoMagnetUriValid(video.magnetUri) &&
           isVideoNameValid(video.name) &&
           isVideoPodUrlValid(video.podUrl) &&
           isVideoTagsValid(video.tags) &&
           isVideoThumbnailValid(video.thumbnailBase64)
  })
}

function isEachRemoveRemoteVideosValid (videos) {
  return videos.every(function (video) {
    return isVideoMagnetUriValid(video.magnetUri)
  })
}

function isArray (value) {
  return Array.isArray(value)
}

function isVideoAuthorValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.AUTHOR)
}

function isVideoDateValid (value) {
  return validator.isDate(value)
}

function isVideoDescriptionValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

function isVideoDurationValid (value) {
  return validator.isInt(value + '', VIDEOS_CONSTRAINTS_FIELDS.DURATION)
}

function isVideoMagnetUriValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.MAGNET_URI)
}

function isVideoNameValid (value) {
  return validator.isLength(value, VIDEOS_CONSTRAINTS_FIELDS.NAME)
}

function isVideoPodUrlValid (value) {
  return validator.isURL(value)
}

function isVideoTagsValid (tags) {
  return isArray(tags) &&
         validator.isInt(tags.length, VIDEOS_CONSTRAINTS_FIELDS.TAGS) &&
         tags.every(function (tag) {
           return validator.isAlphanumeric(tag) &&
                  validator.isLength(tag, VIDEOS_CONSTRAINTS_FIELDS.TAG)
         })
}

function isVideoThumbnailValid (value) {
  return validator.isBase64(value) &&
         validator.isByteLength(value, VIDEOS_CONSTRAINTS_FIELDS.THUMBNAIL)
}

// ---------------------------------------------------------------------------

module.exports = customValidators

// ---------------------------------------------------------------------------
