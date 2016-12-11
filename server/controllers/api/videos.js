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

    function findOrCreateAuthor (callback) {
      const username = res.locals.oauth.token.user.username

      const query = {
        where: {
          name: username,
          podId: null
        },
        defaults: {
          name: username,
          podId: null // null because it is OUR pod
        }
      }

      db.Author.findOrCreate(query).asCallback(function (err, result) {
        // [ instance, wasCreated ]
        return callback(err, result[0])
      })
    },

    function createVideoObject (author, callback) {
      const videoData = {
        name: videoInfos.name,
        remoteId: null,
        extname: path.extname(videoFile.filename),
        description: videoInfos.description,
        duration: videoFile.duration,
        tags: videoInfos.tags,
        authorId: author.id
      }

      const video = db.Video.build(videoData)

      return callback(null, author, video)
    },

     // Set the videoname the same as the id
    function renameVideoFile (author, video, callback) {
      const videoDir = constants.CONFIG.STORAGE.VIDEOS_DIR
      const source = path.join(videoDir, videoFile.filename)
      const destination = path.join(videoDir, video.getVideoFilename())

      fs.rename(source, destination, function (err) {
        return callback(err, author, video)
      })
    },

    function insertIntoDB (author, video, callback) {
      video.save().asCallback(function (err, videoCreated) {
        // Do not forget to add Author informations to the created video
        videoCreated.Author = author

        return callback(err, videoCreated)
      })
    },

    function sendToFriends (video, callback) {
      video.toRemoteJSON(function (err, remoteVideo) {
        if (err) return callback(err)

        // Now we'll add the video's meta data to our friends
        friends.addVideoToFriends(remoteVideo)

        return callback(null)
      })
    }

  ], function andFinally (err) {
    if (err) {
      logger.error('Cannot insert the video.')
      return next(err)
    }

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function getVideo (req, res, next) {
  db.Video.loadAndPopulateAuthorAndPod(req.params.id, function (err, video) {
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
  db.Video.searchAndPopulateAuthorAndPod(req.params.value, req.query.field, req.query.start, req.query.count, req.query.sort,
  function (err, videosList, videosTotal) {
    if (err) return next(err)

    res.json(getFormatedVideos(videosList, videosTotal))
  })
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
