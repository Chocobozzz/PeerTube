'use strict'

const config = require('config')
const crypto = require('crypto')
const express = require('express')
const ffmpeg = require('fluent-ffmpeg')
const multer = require('multer')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middleware = require('../../../middlewares')
const oAuth2 = require('../../../middlewares/oauth2')
const cacheMiddleware = middleware.cache
const reqValidator = middleware.reqValidators.videos
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
    crypto.pseudoRandomBytes(16, function (err, raw) {
      const fieldname = err ? undefined : raw.toString('hex')
      cb(null, fieldname + '.' + extension)
    })
  }
})

const reqFiles = multer({ storage: storage }).fields([{ name: 'videofile', maxCount: 1 }])

router.get('/', cacheMiddleware.cache(false), listVideos)
router.post('/', oAuth2.authenticate, reqFiles, reqValidator.videosAdd, cacheMiddleware.cache(false), addVideo)
router.get('/:id', reqValidator.videosGet, cacheMiddleware.cache(false), getVideos)
router.delete('/:id', oAuth2.authenticate, reqValidator.videosRemove, cacheMiddleware.cache(false), removeVideo)
router.get('/search/:name', reqValidator.videosSearch, cacheMiddleware.cache(false), searchVideos)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addVideo (req, res, next) {
  const video_file = req.files.videofile[0]
  const video_infos = req.body

  videos.seed(video_file.path, function (err, torrent) {
    if (err) {
      logger.error('Cannot seed this video.')
      return next(err)
    }

    ffmpeg.ffprobe(video_file.path, function (err, metadata) {
      if (err) {
        // TODO: unseed the video
        logger.error('Cannot retrieve metadata of the file')
        return next(err)
      }

      const duration = Math.floor(metadata.format.duration)

      const video_data = {
        name: video_infos.name,
        namePath: video_file.filename,
        description: video_infos.description,
        magnetUri: torrent.magnetURI,
        author: res.locals.oauth.token.user.username,
        duration: duration
      }

      Videos.add(video_data, function (err) {
        if (err) {
          // TODO unseed the video
          logger.error('Cannot insert this video in the database.')
          return next(err)
        }

        // Now we'll add the video's meta data to our friends
        friends.addVideoToFriends(video_data)

        // TODO : include Location of the new video -> 201
        res.type('json').status(204).end()
      })
    })
  })
}

function getVideos (req, res, next) {
  Videos.get(req.params.id, function (err, video_obj) {
    if (err) return next(err)

    const state = videos.getVideoState(video_obj)
    if (state.exist === false) {
      return res.type('json').status(204).end()
    }

    res.json(getFormatedVideo(video_obj))
  })
}

function listVideos (req, res, next) {
  Videos.list(function (err, videos_list) {
    if (err) return next(err)

    res.json(getFormatedVideos(videos_list))
  })
}

function removeVideo (req, res, next) {
  const video_id = req.params.id
  Videos.get(video_id, function (err, video) {
    if (err) return next(err)

    removeTorrent(video.magnetUri, function () {
      Videos.removeOwned(req.params.id, function (err) {
        if (err) return next(err)

        const params = {
          name: video.name,
          magnetUri: video.magnetUri
        }

        friends.removeVideoToFriends(params)
        res.type('json').status(204).end()
      })
    })
  })
}

function searchVideos (req, res, next) {
  Videos.search(req.params.name, function (err, videos_list) {
    if (err) return next(err)

    res.json(getFormatedVideos(videos_list))
  })
}

// ---------------------------------------------------------------------------

function getFormatedVideo (video_obj) {
  const formated_video = {
    id: video_obj._id,
    name: video_obj.name,
    description: video_obj.description,
    podUrl: video_obj.podUrl,
    isLocal: videos.getVideoState(video_obj).owned,
    magnetUri: video_obj.magnetUri,
    author: video_obj.author,
    duration: video_obj.duration
  }

  return formated_video
}

function getFormatedVideos (videos_obj) {
  const formated_videos = []

  videos_obj.forEach(function (video_obj) {
    formated_videos.push(getFormatedVideo(video_obj))
  })

  return formated_videos
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
