import express = require('express')
import { waterfall } from 'async'

import { database as db } from '../../../initializers/database'
import friends = require('../../../lib/friends')
import {
  logger,
  getFormatedObjects,
  retryTransactionWrapper,
  startSerializableTransaction,
  commitTransaction,
  rollbackTransaction
} from '../../../helpers'
import {
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  videoAbuseReportValidator,
  videoAbusesSortValidator,
  setVideoAbusesSort,
  setPagination
} from '../../../middlewares'

const abuseVideoRouter = express.Router()

abuseVideoRouter.get('/abuse',
  authenticate,
  ensureIsAdmin,
  paginationValidator,
  videoAbusesSortValidator,
  setVideoAbusesSort,
  setPagination,
  listVideoAbuses
)
abuseVideoRouter.post('/:id/abuse',
  authenticate,
  videoAbuseReportValidator,
  reportVideoAbuseRetryWrapper
)

// ---------------------------------------------------------------------------

export {
  abuseVideoRouter
}

// ---------------------------------------------------------------------------

function listVideoAbuses (req, res, next) {
  db.VideoAbuse.listForApi(req.query.start, req.query.count, req.query.sort, function (err, abusesList, abusesTotal) {
    if (err) return next(err)

    res.json(getFormatedObjects(abusesList, abusesTotal))
  })
}

function reportVideoAbuseRetryWrapper (req, res, next) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot report abuse to the video with many retries.'
  }

  retryTransactionWrapper(reportVideoAbuse, options, function (err) {
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

    startSerializableTransaction,

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

    commitTransaction

  ], function andFinally (err, t) {
    if (err) {
      logger.debug('Cannot update the video.', { error: err })
      return rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Abuse report for video %s created.', videoInstance.name)
    return finalCallback(null)
  })
}
