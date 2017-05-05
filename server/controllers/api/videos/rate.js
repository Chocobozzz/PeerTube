'use strict'

const express = require('express')
const waterfall = require('async/waterfall')

const constants = require('../../../initializers/constants')
const db = require('../../../initializers/database')
const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const oAuth = middlewares.oauth
const validators = middlewares.validators
const validatorsVideos = validators.videos
const databaseUtils = require('../../../helpers/database-utils')

const router = express.Router()

router.put('/:id/rate',
  oAuth.authenticate,
  validatorsVideos.videoRate,
  rateVideoRetryWrapper
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function rateVideoRetryWrapper (req, res, next) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the user video rate.'
  }

  databaseUtils.retryTransactionWrapper(rateVideo, options, function (err) {
    if (err) return next(err)

    return res.type('json').status(204).end()
  })
}

function rateVideo (req, res, finalCallback) {
  const rateType = req.body.rating
  const videoInstance = res.locals.video
  const userInstance = res.locals.oauth.token.User

  waterfall([
    databaseUtils.startSerializableTransaction,

    function findPreviousRate (t, callback) {
      db.UserVideoRate.load(userInstance.id, videoInstance.id, t, function (err, previousRate) {
        return callback(err, t, previousRate)
      })
    },

    function insertUserRateIntoDB (t, previousRate, callback) {
      const options = { transaction: t }

      let likesToIncrement = 0
      let dislikesToIncrement = 0

      if (rateType === constants.VIDEO_RATE_TYPES.LIKE) likesToIncrement++
      else if (rateType === constants.VIDEO_RATE_TYPES.DISLIKE) dislikesToIncrement++

      // There was a previous rate, update it
      if (previousRate) {
        // We will remove the previous rate, so we will need to remove it from the video attribute
        if (previousRate.type === constants.VIDEO_RATE_TYPES.LIKE) likesToIncrement--
        else if (previousRate.type === constants.VIDEO_RATE_TYPES.DISLIKE) dislikesToIncrement--

        previousRate.type = rateType

        previousRate.save(options).asCallback(function (err) {
          return callback(err, t, likesToIncrement, dislikesToIncrement)
        })
      } else { // There was not a previous rate, insert a new one
        const query = {
          userId: userInstance.id,
          videoId: videoInstance.id,
          type: rateType
        }

        db.UserVideoRate.create(query, options).asCallback(function (err) {
          return callback(err, t, likesToIncrement, dislikesToIncrement)
        })
      }
    },

    function updateVideoAttributeDB (t, likesToIncrement, dislikesToIncrement, callback) {
      const options = { transaction: t }
      const incrementQuery = {
        likes: likesToIncrement,
        dislikes: dislikesToIncrement
      }

      // Even if we do not own the video we increment the attributes
      // It is usefull for the user to have a feedback
      videoInstance.increment(incrementQuery, options).asCallback(function (err) {
        return callback(err, t, likesToIncrement, dislikesToIncrement)
      })
    },

    function sendEventsToFriendsIfNeeded (t, likesToIncrement, dislikesToIncrement, callback) {
      // No need for an event type, we own the video
      if (videoInstance.isOwned()) return callback(null, t, likesToIncrement, dislikesToIncrement)

      const eventsParams = []

      if (likesToIncrement !== 0) {
        eventsParams.push({
          videoId: videoInstance.id,
          type: constants.REQUEST_VIDEO_EVENT_TYPES.LIKES,
          count: likesToIncrement
        })
      }

      if (dislikesToIncrement !== 0) {
        eventsParams.push({
          videoId: videoInstance.id,
          type: constants.REQUEST_VIDEO_EVENT_TYPES.DISLIKES,
          count: dislikesToIncrement
        })
      }

      friends.addEventsToRemoteVideo(eventsParams, t, function (err) {
        return callback(err, t, likesToIncrement, dislikesToIncrement)
      })
    },

    function sendQaduToFriendsIfNeeded (t, likesToIncrement, dislikesToIncrement, callback) {
      // We do not own the video, there is no need to send a quick and dirty update to friends
      // Our rate was already sent by the addEvent function
      if (videoInstance.isOwned() === false) return callback(null, t)

      const qadusParams = []

      if (likesToIncrement !== 0) {
        qadusParams.push({
          videoId: videoInstance.id,
          type: constants.REQUEST_VIDEO_QADU_TYPES.LIKES
        })
      }

      if (dislikesToIncrement !== 0) {
        qadusParams.push({
          videoId: videoInstance.id,
          type: constants.REQUEST_VIDEO_QADU_TYPES.DISLIKES
        })
      }

      friends.quickAndDirtyUpdatesVideoToFriends(qadusParams, t, function (err) {
        return callback(err, t)
      })
    },

    databaseUtils.commitTransaction

  ], function (err, t) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot add the user video rate.', { error: err })
      return databaseUtils.rollbackTransaction(err, t, finalCallback)
    }

    logger.info('User video rate for video %s of user %s updated.', videoInstance.name, userInstance.username)
    return finalCallback(null)
  })
}
