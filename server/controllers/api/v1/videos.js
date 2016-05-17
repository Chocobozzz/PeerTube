'use strict'

const async = require('async')
const config = require('config')
const express = require('express')
const fs = require('fs')
const path = require('path')
const multer = require('multer')

const constants = require('../../../initializers/constants')
const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middlewares = require('../../../middlewares')
const oAuth2 = middlewares.oauth2
const pagination = middlewares.pagination
const reqValidator = middlewares.reqValidators
const reqValidatorPagination = reqValidator.pagination
const reqValidatorSort = reqValidator.sort
const reqValidatorVideos = reqValidator.videos
const sort = middlewares.sort
const utils = require('../../../helpers/utils')
const Videos = require('../../../models/videos') // model
const videos = require('../../../lib/videos')
const webtorrent = require('../../../lib/webtorrent')

const router = express.Router()
const uploads = config.get('storage.uploads')

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
const thumbnailsDir = path.join(__dirname, '..', '..', '..', '..', config.get('storage.thumbnails'))

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
  getVideos
)
router.delete('/:id',
  oAuth2.authenticate,
  reqValidatorVideos.videosRemove,
  removeVideo
)
router.get('/search/:name',
  reqValidatorVideos.videosSearch,
  reqValidatorPagination.pagination,
  reqValidatorSort.videosSort,
  sort.setVideosSort,
  pagination.setPagination,
  searchVideos
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addVideo (req, res, next) {
  const videoFile = req.files.videofile[0]
  const videoInfos = req.body

  async.waterfall([
    function seedTheVideo (callback) {
      videos.seed(videoFile.path, callback)
    },

    function createThumbnail (torrent, callback) {
      videos.createVideoThumbnail(videoFile.path, function (err, thumbnailName) {
        if (err) {
          // TODO: unseed the video
          logger.error('Cannot make a thumbnail of the video file.')
          return callback(err)
        }

        callback(null, torrent, thumbnailName)
      })
    },

    function insertIntoDB (torrent, thumbnailName, callback) {
      const videoData = {
        name: videoInfos.name,
        namePath: videoFile.filename,
        description: videoInfos.description,
        magnetUri: torrent.magnetURI,
        author: res.locals.oauth.token.user.username,
        duration: videoFile.duration,
        thumbnail: thumbnailName
      }

      Videos.add(videoData, function (err, insertedVideo) {
        if (err) {
          // TODO unseed the video
          // TODO remove thumbnail
          logger.error('Cannot insert this video in the database.')
          return callback(err)
        }

        return callback(null, torrent, thumbnailName, videoData, insertedVideo)
      })
    },

    function getThumbnailBase64 (torrent, thumbnailName, videoData, insertedVideo, callback) {
      videoData.createdDate = insertedVideo.createdDate

      fs.readFile(thumbnailsDir + thumbnailName, function (err, thumbnailData) {
        if (err) {
          // TODO unseed the video
          // TODO remove thumbnail
          // TODO: remove video
          logger.error('Cannot read the thumbnail of the video')
          return callback(err)
        }

        return callback(null, videoData, thumbnailData)
      })
    },

    function sendToFriends (videoData, thumbnailData, callback) {
      // Set the image in base64
      videoData.thumbnailBase64 = new Buffer(thumbnailData).toString('base64')

      // Now we'll add the video's meta data to our friends
      friends.addVideoToFriends(videoData)

      return callback(null)
    }

  ], function (err) {
    if (err) {
      logger.error('Cannot insert the video.')
      return next(err)
    }

    // TODO : include Location of the new video -> 201
    return res.type('json').status(204).end()
  })
}

function getVideos (req, res, next) {
  Videos.get(req.params.id, function (err, videoObj) {
    if (err) return next(err)

    const state = videos.getVideoState(videoObj)
    if (state.exist === false) {
      return res.type('json').status(204).end()
    }

    res.json(getFormatedVideo(videoObj))
  })
}

function listVideos (req, res, next) {
  Videos.list(req.query.start, req.query.count, req.query.sort, function (err, videosList) {
    if (err) return next(err)

    res.json(getFormatedVideos(videosList))
  })
}

function removeVideo (req, res, next) {
  const videoId = req.params.id

  async.waterfall([
    function getVideo (callback) {
      Videos.get(videoId, callback)
    },

    function removeVideoTorrent (video, callback) {
      removeTorrent(video.magnetUri, function () {
        return callback(null, video)
      })
    },

    function removeFromDB (video, callback) {
      Videos.removeOwned(req.params.id, function (err) {
        if (err) return callback(err)

        return callback(null, video)
      })
    },

    function removeVideoData (video, callback) {
      videos.removeVideosDataFromDisk([ video ], function (err) {
        if (err) logger.error('Cannot remove video data from disk.', { video: video })

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
  ], function (err) {
    if (err) {
      logger.error('Errors when removed the video.', { error: err })
      return next(err)
    }

    return res.type('json').status(204).end()
  })
}

function searchVideos (req, res, next) {
  Videos.search(req.params.name, req.query.start, req.query.count, req.query.sort, function (err, videosList) {
    if (err) return next(err)

    res.json(getFormatedVideos(videosList))
  })
}

// ---------------------------------------------------------------------------

function getFormatedVideo (videoObj) {
  const formatedVideo = {
    id: videoObj._id,
    name: videoObj.name,
    description: videoObj.description,
    podUrl: videoObj.podUrl,
    isLocal: videos.getVideoState(videoObj).owned,
    magnetUri: videoObj.magnetUri,
    author: videoObj.author,
    duration: videoObj.duration,
    thumbnailPath: constants.THUMBNAILS_STATIC_PATH + '/' + videoObj.thumbnail,
    createdDate: videoObj.createdDate
  }

  return formatedVideo
}

function getFormatedVideos (videosObj) {
  const formatedVideos = []

  videosObj.forEach(function (videoObj) {
    formatedVideos.push(getFormatedVideo(videoObj))
  })

  return formatedVideos
}

// Maybe the torrent is not seeded, but we catch the error to don't stop the removing process
function removeTorrent (magnetUri, callback) {
  try {
    webtorrent.remove(magnetUri, callback)
  } catch (err) {
    logger.warn('Cannot remove the torrent from WebTorrent', { err: err })
    return callback(null)
  }
}
