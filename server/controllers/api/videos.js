'use strict'

const each = require('async/each')
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

router.get('/',
  validatorsPagination.pagination,
  validatorsSort.videosSort,
  sort.setVideosSort,
  pagination.setPagination,
  listVideos
)
router.post('/',
  oAuth.authenticate,
  reqFiles,
  validatorsVideos.videosAdd,
  addVideo
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

function addVideo (req, res, next) {
  const videoFile = req.files.videofile[0]
  const videoInfos = req.body

  waterfall([

    function startTransaction (callback) {
      db.sequelize.transaction().asCallback(function (err, t) {
        return callback(err, t)
      })
    },

    function findOrCreateAuthor (t, callback) {
      const username = res.locals.oauth.token.user.username

      const query = {
        where: {
          name: username,
          podId: null
        },
        defaults: {
          name: username,
          podId: null // null because it is OUR pod
        },
        transaction: t
      }

      db.Author.findOrCreate(query).asCallback(function (err, result) {
        // [ instance, wasCreated ]
        return callback(err, t, result[0])
      })
    },

    function findOrCreateTags (t, author, callback) {
      const tags = videoInfos.tags
      const tagInstances = []

      each(tags, function (tag, callbackEach) {
        const query = {
          where: {
            name: tag
          },
          defaults: {
            name: tag
          },
          transaction: t
        }

        db.Tag.findOrCreate(query).asCallback(function (err, res) {
          if (err) return callbackEach(err)

          // res = [ tag, isCreated ]
          const tag = res[0]
          tagInstances.push(tag)
          return callbackEach()
        })
      }, function (err) {
        return callback(err, t, author, tagInstances)
      })
    },

    function createVideoObject (t, author, tagInstances, callback) {
      const videoData = {
        name: videoInfos.name,
        remoteId: null,
        extname: path.extname(videoFile.filename),
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
        return callback(err, t, author, tagInstances, video)
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
      video.toRemoteJSON(function (err, remoteVideo) {
        if (err) return callback(err)

        // Now we'll add the video's meta data to our friends
        friends.addVideoToFriends(remoteVideo)

        return callback(null, t)
      })
    }

  ], function andFinally (err, t) {
    if (err) {
      logger.error('Cannot insert the video.')

      // Abort transaction?
      if (t) t.rollback()

      return next(err)
    }

    // Commit transaction
    t.commit()

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function getVideo (req, res, next) {
  db.Video.loadAndPopulateAuthorAndPodAndTags(req.params.id, function (err, video) {
    if (err) return next(err)

    if (!video) {
      return res.type('json').status(204).end()
    }

    res.json(video.toFormatedJSON())
  })
}

function listVideos (req, res, next) {
  db.Video.listForApi(req.query.start, req.query.count, req.query.sort, function (err, videosList, videosTotal) {
    if (err) return next(err)

    res.json(getFormatedVideos(videosList, videosTotal))
  })
}

function removeVideo (req, res, next) {
  const videoId = req.params.id

  waterfall([
    function getVideo (callback) {
      db.Video.load(videoId, callback)
    },

    function removeFromDB (video, callback) {
      video.destroy().asCallback(function (err) {
        if (err) return callback(err)

        return callback(null, video)
      })
    },

    function sendInformationToFriends (video, callback) {
      const params = {
        name: video.name,
        remoteId: video.id
      }

      friends.removeVideoToFriends(params)

      return callback(null)
    }
  ], function andFinally (err) {
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

      res.json(getFormatedVideos(videosList, videosTotal))
    }
  )
}

// ---------------------------------------------------------------------------

function getFormatedVideos (videos, videosTotal) {
  const formatedVideos = []

  videos.forEach(function (video) {
    formatedVideos.push(video.toFormatedJSON())
  })

  return {
    total: videosTotal,
    data: formatedVideos
  }
}
