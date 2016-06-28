'use strict'

const async = require('async')
const config = require('config')
const express = require('express')
const mongoose = require('mongoose')
const multer = require('multer')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const oAuth2 = middlewares.oauth2
const pagination = middlewares.pagination
const reqValidator = middlewares.reqValidators
const reqValidatorPagination = reqValidator.pagination
const reqValidatorSort = reqValidator.sort
const reqValidatorVideos = reqValidator.videos
const search = middlewares.search
const sort = middlewares.sort
const utils = require('../../../helpers/utils')

const router = express.Router()
const uploads = config.get('storage.uploads')
const Video = mongoose.model('Video')

// multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploads)
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
  reqValidatorPagination.pagination,
  reqValidatorSort.videosSort,
  sort.setVideosSort,
  pagination.setPagination,
  listVideos
)
router.post('/',
  oAuth2.authenticate,
  reqFiles,
  reqValidatorVideos.videosAdd,
  addVideo
)
router.get('/:id',
  reqValidatorVideos.videosGet,
  getVideo
)
router.delete('/:id',
  oAuth2.authenticate,
  reqValidatorVideos.videosRemove,
  removeVideo
)
router.get('/search/:value',
  reqValidatorVideos.videosSearch,
  reqValidatorPagination.pagination,
  reqValidatorSort.videosSort,
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

  async.waterfall([

    function insertIntoDB (callback) {
      const videoData = {
        name: videoInfos.name,
        filename: videoFile.filename,
        description: videoInfos.description,
        author: res.locals.oauth.token.user.username,
        duration: videoFile.duration,
        tags: videoInfos.tags
      }

      const video = new Video(videoData)
      video.save(function (err, video) {
        // Assert there are only one argument sent to the next function (video)
        return callback(err, video)
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
      // TODO unseed the video
      // TODO remove thumbnail
      // TODO delete from DB
      logger.error('Cannot insert the video.')
      return next(err)
    }

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function getVideo (req, res, next) {
  Video.load(req.params.id, function (err, video) {
    if (err) return next(err)

    if (!video) {
      return res.type('json').status(204).end()
    }

    res.json(video.toFormatedJSON())
  })
}

function listVideos (req, res, next) {
  Video.list(req.query.start, req.query.count, req.query.sort, function (err, videosList, videosTotal) {
    if (err) return next(err)

    res.json(getFormatedVideos(videosList, videosTotal))
  })
}

function removeVideo (req, res, next) {
  const videoId = req.params.id

  async.waterfall([
    function getVideo (callback) {
      Video.load(videoId, callback)
    },

    function removeFromDB (video, callback) {
      video.remove(function (err) {
        if (err) return callback(err)

        return callback(null, video)
      })
    },

    function sendInformationToFriends (video, callback) {
      const params = {
        name: video.name,
        magnetUri: video.magnetUri
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
  Video.search(req.params.value, req.query.field, req.query.start, req.query.count, req.query.sort,
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
