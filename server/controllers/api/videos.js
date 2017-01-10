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

// Wrapper to video add that retry the function if there is a database error
// We need this because we run the transaction in SERIALIZABLE isolation that can fail
function addVideoRetryWrapper (req, res, next) {
  utils.transactionRetryer(
    function (callback) {
      return addVideo(req, res, req.files.videofile[0], callback)
    },
    function (err) {
      if (err) {
        logger.error('Cannot insert the video with many retries.', { error: err })
        return next(err)
      }

      // TODO : include Location of the new video -> 201
      return res.type('json').status(204).end()
    }
  )
}

function addVideo (req, res, videoFile, callback) {
  const videoInfos = req.body

  waterfall([

    function startTransaction (callbackWaterfall) {
      db.sequelize.transaction({ isolationLevel: 'SERIALIZABLE' }).asCallback(function (err, t) {
        return callbackWaterfall(err, t)
      })
    },

    function findOrCreateAuthor (t, callbackWaterfall) {
      const user = res.locals.oauth.token.User

      const name = user.username
      // null because it is OUR pod
      const podId = null
      const userId = user.id

      db.Author.findOrCreateAuthor(name, podId, userId, t, function (err, authorInstance) {
        return callbackWaterfall(err, t, authorInstance)
      })
    },

    function findOrCreateTags (t, author, callbackWaterfall) {
      const tags = videoInfos.tags

      db.Tag.findOrCreateTags(tags, t, function (err, tagInstances) {
        return callbackWaterfall(err, t, author, tagInstances)
      })
    },

    function createVideoObject (t, author, tagInstances, callbackWaterfall) {
      const videoData = {
        name: videoInfos.name,
        remoteId: null,
        extname: path.extname(videoFile.filename),
        description: videoInfos.description,
        duration: videoFile.duration,
        authorId: author.id
      }

      const video = db.Video.build(videoData)

      return callbackWaterfall(null, t, author, tagInstances, video)
    },

     // Set the videoname the same as the id
    function renameVideoFile (t, author, tagInstances, video, callbackWaterfall) {
      const videoDir = constants.CONFIG.STORAGE.VIDEOS_DIR
      const source = path.join(videoDir, videoFile.filename)
      const destination = path.join(videoDir, video.getVideoFilename())

      fs.rename(source, destination, function (err) {
        if (err) return callbackWaterfall(err)

        // This is important in case if there is another attempt
        videoFile.filename = video.getVideoFilename()
        return callbackWaterfall(null, t, author, tagInstances, video)
      })
    },

    function insertVideoIntoDB (t, author, tagInstances, video, callbackWaterfall) {
      const options = { transaction: t }

      // Add tags association
      video.save(options).asCallback(function (err, videoCreated) {
        if (err) return callbackWaterfall(err)

        // Do not forget to add Author informations to the created video
        videoCreated.Author = author

        return callbackWaterfall(err, t, tagInstances, videoCreated)
      })
    },

    function associateTagsToVideo (t, tagInstances, video, callbackWaterfall) {
      const options = { transaction: t }

      video.setTags(tagInstances, options).asCallback(function (err) {
        video.Tags = tagInstances

        return callbackWaterfall(err, t, video)
      })
    },

    function sendToFriends (t, video, callbackWaterfall) {
      video.toAddRemoteJSON(function (err, remoteVideo) {
        if (err) return callbackWaterfall(err)

        // Now we'll add the video's meta data to our friends
        friends.addVideoToFriends(remoteVideo, t, function (err) {
          return callbackWaterfall(err, t)
        })
      })
    }

  ], function andFinally (err, t) {
    if (err) {
      // This is just a debug because we will retry the insert
      logger.debug('Cannot insert the video.', { error: err })

      // Abort transaction?
      if (t) t.rollback()

      return callback(err)
    }

    // Commit transaction
    t.commit()

    logger.info('Video with name %s created.', videoInfos.name)

    return callback(null)
  })
}

function updateVideoRetryWrapper (req, res, next) {
  utils.transactionRetryer(
    function (callback) {
      return updateVideo(req, res, callback)
    },
    function (err) {
      if (err) {
        logger.error('Cannot update the video with many retries.', { error: err })
        return next(err)
      }

      // TODO : include Location of the new video -> 201
      return res.type('json').status(204).end()
    }
  )
}

function updateVideo (req, res, finalCallback) {
  const videoInstance = res.locals.video
  const videoInfosToUpdate = req.body

  waterfall([

    function startTransaction (callback) {
      db.sequelize.transaction().asCallback(function (err, t) {
        return callback(err, t)
      })
    },

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
      const options = { transaction: t }

      if (videoInfosToUpdate.name) videoInstance.set('name', videoInfosToUpdate.name)
      if (videoInfosToUpdate.description) videoInstance.set('description', videoInfosToUpdate.description)

      // Add tags association
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
    }

  ], function andFinally (err, t) {
    if (err) {
      logger.debug('Cannot update the video.', { error: err })

      // Abort transaction?
      if (t) t.rollback()

      return finalCallback(err)
    }

    // Commit transaction
    t.commit()

    return finalCallback(null)
  })
}

function getVideo (req, res, next) {
  const videoInstance = res.locals.video
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
  utils.transactionRetryer(
    function (callback) {
      return reportVideoAbuse(req, res, callback)
    },
    function (err) {
      if (err) {
        logger.error('Cannot report abuse to the video with many retries.', { error: err })
        return next(err)
      }

      return res.type('json').status(204).end()
    }
  )
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

    function startTransaction (callback) {
      db.sequelize.transaction().asCallback(function (err, t) {
        return callback(err, t)
      })
    },

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
    }

  ], function andFinally (err, t) {
    if (err) {
      logger.debug('Cannot update the video.', { error: err })

      // Abort transaction?
      if (t) t.rollback()

      return finalCallback(err)
    }

    // Commit transaction
    t.commit()

    return finalCallback(null)
  })
}

