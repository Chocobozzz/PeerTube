'use strict'

const express = require('express')
const fs = require('fs')
const multer = require('multer')
const path = require('path')
const waterfall = require('async/waterfall')

const constants = require('../../initializers/constants')
const db = require('../../initializers/database')
const logger = require('../../helpers/logger')
const friends = require('../../lib/friends')
const middlewares = require('../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const pagination = middlewares.pagination
const validators = middlewares.validators
const validatorsPagination = validators.pagination
const validatorsSort = validators.sort
const validatorsVideos = validators.videos
const search = middlewares.search
const sort = middlewares.sort
const databaseUtils = require('../../helpers/database-utils')
const utils = require('../../helpers/utils')

const router = express.Router()

// multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, constants.CONFIG.STORAGE.VIDEOS_DIR)
  },

  filename: function (req, file, cb) {
    let extension = ''
    if (file.mimetype === 'video/webm') extension = 'webm'
    else if (file.mimetype === 'video/mp4') extension = 'mp4'
    else if (file.mimetype === 'video/ogg') extension = 'ogv'
    utils.generateRandomString(16, function (err, randomString) {
      const fieldname = err ? undefined : randomString
      cb(null, fieldname + '.' + extension)
    })
  }
})

const reqFiles = multer({ storage: storage }).fields([{ name: 'videofile', maxCount: 1 }])

router.get('/categories', listVideoCategories)
router.get('/licences', listVideoLicences)
router.get('/languages', listVideoLanguages)

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

router.put('/:id/rate',
  oAuth.authenticate,
  validatorsVideos.videoRate,
  rateVideoRetryWrapper
)

router.get('/',
  validatorsPagination.pagination,
  validatorsSort.videosSort,
  sort.setVideosSort,
  pagination.setPagination,
  listVideos
)
router.put('/:id',
  oAuth.authenticate,
  reqFiles,
  validatorsVideos.videosUpdate,
  updateVideoRetryWrapper
)
router.post('/',
  oAuth.authenticate,
  reqFiles,
  validatorsVideos.videosAdd,
  addVideoRetryWrapper
)
router.get('/:id',
  validatorsVideos.videosGet,
  getVideo
)
router.delete('/:id',
  oAuth.authenticate,
  validatorsVideos.videosRemove,
  removeVideo
)
router.get('/search/:value',
  validatorsVideos.videosSearch,
  validatorsPagination.pagination,
  validatorsSort.videosSort,
  sort.setVideosSort,
  pagination.setPagination,
  search.setVideosSearch,
  searchVideos
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function listVideoCategories (req, res, next) {
  res.json(constants.VIDEO_CATEGORIES)
}

function listVideoLicences (req, res, next) {
  res.json(constants.VIDEO_LICENCES)
}

function listVideoLanguages (req, res, next) {
  res.json(constants.VIDEO_LANGUAGES)
}

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

// Wrapper to video add that retry the function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
function addVideoRetryWrapper (req, res, next) {
  const options = {
    arguments: [ req, res, req.files.videofile[0] ],
    errorMessage: 'Cannot insert the video with many retries.'
  }

  databaseUtils.retryTransactionWrapper(addVideo, options, function (err) {
    if (err) return next(err)

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function addVideo (req, res, videoFile, finalCallback) {
  const videoInfos = req.body

  waterfall([

    databaseUtils.startSerializableTransaction,

    function findOrCreateAuthor (t, callback) {
      const user = res.locals.oauth.token.User

      const name = user.username
      // null because it is OUR pod
      const podId = null
      const userId = user.id

      db.Author.findOrCreateAuthor(name, podId, userId, t, function (err, authorInstance) {
        return callback(err, t, authorInstance)
      })
    },

    function findOrCreateTags (t, author, callback) {
      const tags = videoInfos.tags

      db.Tag.findOrCreateTags(tags, t, function (err, tagInstances) {
        return callback(err, t, author, tagInstances)
      })
    },

    function createVideoObject (t, author, tagInstances, callback) {
      const videoData = {
        name: videoInfos.name,
        remoteId: null,
        extname: path.extname(videoFile.filename),
        category: videoInfos.category,
        licence: videoInfos.licence,
        language: videoInfos.language,
        nsfw: videoInfos.nsfw,
        description: videoInfos.description,
        duration: videoFile.duration,
        authorId: author.id
      }

      const video = db.Video.build(videoData)

      return callback(null, t, author, tagInstances, video)
    },

     // Set the videoname the same as the id
    function renameVideoFile (t, author, tagInstances, video, callback) {
      const videoDir = constants.CONFIG.STORAGE.VIDEOS_DIR
      const source = path.join(videoDir, videoFile.filename)
      const destination = path.join(videoDir, video.getVideoFilename())

      fs.rename(source, destination, function (err) {
        if (err) return callback(err)

        // This is important in case if there is another attempt
        videoFile.filename = video.getVideoFilename()
        return callback(null, t, author, tagInstances, video)
      })
    },

    function insertVideoIntoDB (t, author, tagInstances, video, callback) {
      const options = { transaction: t }

      // Add tags association
      video.save(options).asCallback(function (err, videoCreated) {
        if (err) return callback(err)

        // Do not forget to add Author informations to the created video
        videoCreated.Author = author

        return callback(err, t, tagInstances, videoCreated)
      })
    },

    function associateTagsToVideo (t, tagInstances, video, callback) {
      const options = { transaction: t }

      video.setTags(tagInstances, options).asCallback(function (err) {
        video.Tags = tagInstances

        return callback(err, t, video)
      })
    },

    function sendToFriends (t, video, callback) {
      video.toAddRemoteJSON(function (err, remoteVideo) {
        if (err) return callback(err)

        // Now we'll add the video's meta data to our friends
        friends.addVideoToFriends(remoteVideo, t, function (err) {
          return callback(err, t)
        })
      })
    },

    databaseUtils.commitTransaction

  ], function andFinally (err, t) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot insert the video.', { error: err })
      return databaseUtils.rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Video with name %s created.', videoInfos.name)
    return finalCallback(null)
  })
}

function updateVideoRetryWrapper (req, res, next) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot update the video with many retries.'
  }

  databaseUtils.retryTransactionWrapper(updateVideo, options, function (err) {
    if (err) return next(err)

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function updateVideo (req, res, finalCallback) {
  const videoInstance = res.locals.video
  const videoFieldsSave = videoInstance.toJSON()
  const videoInfosToUpdate = req.body

  waterfall([

    databaseUtils.startSerializableTransaction,

    function findOrCreateTags (t, callback) {
      if (videoInfosToUpdate.tags) {
        db.Tag.findOrCreateTags(videoInfosToUpdate.tags, t, function (err, tagInstances) {
          return callback(err, t, tagInstances)
        })
      } else {
        return callback(null, t, null)
      }
    },

    function updateVideoIntoDB (t, tagInstances, callback) {
      const options = {
        transaction: t
      }

      if (videoInfosToUpdate.name) videoInstance.set('name', videoInfosToUpdate.name)
      if (videoInfosToUpdate.category) videoInstance.set('category', videoInfosToUpdate.category)
      if (videoInfosToUpdate.licence) videoInstance.set('licence', videoInfosToUpdate.licence)
      if (videoInfosToUpdate.language) videoInstance.set('language', videoInfosToUpdate.language)
      if (videoInfosToUpdate.nsfw) videoInstance.set('nsfw', videoInfosToUpdate.nsfw)
      if (videoInfosToUpdate.description) videoInstance.set('description', videoInfosToUpdate.description)

      videoInstance.save(options).asCallback(function (err) {
        return callback(err, t, tagInstances)
      })
    },

    function associateTagsToVideo (t, tagInstances, callback) {
      if (tagInstances) {
        const options = { transaction: t }

        videoInstance.setTags(tagInstances, options).asCallback(function (err) {
          videoInstance.Tags = tagInstances

          return callback(err, t)
        })
      } else {
        return callback(null, t)
      }
    },

    function sendToFriends (t, callback) {
      const json = videoInstance.toUpdateRemoteJSON()

      // Now we'll update the video's meta data to our friends
      friends.updateVideoToFriends(json, t, function (err) {
        return callback(err, t)
      })
    },

    databaseUtils.commitTransaction

  ], function andFinally (err, t) {
    if (err) {
      logger.debug('Cannot update the video.', { error: err })

      // Force fields we want to update
      // If the transaction is retried, sequelize will think the object has not changed
      // So it will skip the SQL request, even if the last one was ROLLBACKed!
      Object.keys(videoFieldsSave).forEach(function (key) {
        const value = videoFieldsSave[key]
        videoInstance.set(key, value)
      })

      return databaseUtils.rollbackTransaction(err, t, finalCallback)
    }

    logger.info('Video with name %s updated.', videoInfosToUpdate.name)
    return finalCallback(null)
  })
}

function getVideo (req, res, next) {
  const videoInstance = res.locals.video

  if (videoInstance.isOwned()) {
    // The increment is done directly in the database, not using the instance value
    videoInstance.increment('views').asCallback(function (err) {
      if (err) {
        logger.error('Cannot add view to video %d.', videoInstance.id)
        return
      }

      // FIXME: make a real view system
      // For example, only add a view when a user watch a video during 30s etc
      const qaduParams = {
        videoId: videoInstance.id,
        type: constants.REQUEST_VIDEO_QADU_TYPES.VIEWS
      }
      friends.quickAndDirtyUpdateVideoToFriends(qaduParams)
    })
  } else {
    // Just send the event to our friends
    const eventParams = {
      videoId: videoInstance.id,
      type: constants.REQUEST_VIDEO_EVENT_TYPES.VIEWS
    }
    friends.addEventToRemoteVideo(eventParams)
  }

  // Do not wait the view system
  res.json(videoInstance.toFormatedJSON())
}

function listVideos (req, res, next) {
  db.Video.listForApi(req.query.start, req.query.count, req.query.sort, function (err, videosList, videosTotal) {
    if (err) return next(err)

    res.json(utils.getFormatedObjects(videosList, videosTotal))
  })
}

function removeVideo (req, res, next) {
  const videoInstance = res.locals.video

  videoInstance.destroy().asCallback(function (err) {
    if (err) {
      logger.error('Errors when removed the video.', { error: err })
      return next(err)
    }

    return res.type('json').status(204).end()
  })
}

function searchVideos (req, res, next) {
  db.Video.searchAndPopulateAuthorAndPodAndTags(
    req.params.value, req.query.field, req.query.start, req.query.count, req.query.sort,
    function (err, videosList, videosTotal) {
      if (err) return next(err)

      res.json(utils.getFormatedObjects(videosList, videosTotal))
    }
  )
}

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
