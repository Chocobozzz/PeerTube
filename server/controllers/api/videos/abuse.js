'use strict'

const express = require('express')
const waterfall = require('async/waterfall')

const db = require('../../../initializers/database')
const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const pagination = middlewares.pagination
const validators = middlewares.validators
const validatorsPagination = validators.pagination
const validatorsSort = validators.sort
const validatorsVideos = validators.videos
const sort = middlewares.sort
const databaseUtils = require('../../../helpers/database-utils')
const utils = require('../../../helpers/utils')

const router = express.Router()

router.get('/abuse',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validatorsPagination.pagination,
  validatorsSort.videoAbusesSort,
  sort.setVideoAbusesSort,
  pagination.setPagination,
  listVideoAbuses
)
router.post('/:id/abuse',
  oAuth.authenticate,
  validatorsVideos.videoAbuseReport,
  reportVideoAbuseRetryWrapper
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function listVideoAbuses (req, res, next) {
  db.VideoAbuse.listForApi(req.query.start, req.query.count, req.query.sort, function (err, abusesList, abusesTotal) {
    if (err) return next(err)

    res.json(utils.getFormatedObjects(abusesList, abusesTotal))
  })
}

function reportVideoAbuseRetryWrapper (req, res, next) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot report abuse to the video with many retries.'
  }

  databaseUtils.retryTransactionWrapper(reportVideoAbuse, options, function (err) {
    if (err) return next(err)

    return res.type('json').status(204).end()
  })
}

function reportVideoAbuse (req, res, finalCallback) {
  const videoInstance = res.locals.video
  const reporterUsername = res.locals.oauth.token.User.username

  const abuse = {
    reporterUsername,
    reason: req.body.reason,
    videoId: videoInstance.id,
    reporterPodId: null // This is our pod that reported this abuse
  }

  waterfall([

    databaseUtils.startSerializableTransaction,

    function createAbuse (t, callback) {
      db.VideoAbuse.create(abuse).asCallback(function (err, abuse) {
        return callback(err, t, abuse)
      })
    },

    function sendToFriendsIfNeeded (t, abuse, callback) {
      // We send the information to the destination pod
      if (videoInstance.isOwned() === false) {
        const reportData = {
          reporterUsername,
          reportReason: abuse.reason,
          videoRemoteId: videoInstance.remoteId
        }

        friends.reportAbuseVideoToFriend(reportData, videoInstance)
      }

      return callback(null, t)
    },

    databaseUtils.commitTransaction

  ], function andFinally (err, t) {
    if (err) {
      logger.debug('Cannot update the video.', { error: err })
      return databaseUtils.rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Abuse report for video %s created.', videoInstance.name)
    return finalCallback(null)
  })
}
