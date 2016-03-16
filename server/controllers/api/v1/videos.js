'use strict'

const config = require('config')
const crypto = require('crypto')
const express = require('express')
const multer = require('multer')

const logger = require('../../../helpers/logger')
const friends = require('../../../lib/friends')
const middleware = require('../../../middlewares')
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

const reqFiles = multer({ storage: storage }).fields([{ name: 'input_video', maxCount: 1 }])

router.get('/', cacheMiddleware.cache(false), listVideos)
router.post('/', reqFiles, reqValidator.videosAdd, cacheMiddleware.cache(false), addVideo)
router.get('/:id', reqValidator.videosGet, cacheMiddleware.cache(false), getVideos)
router.delete('/:id', reqValidator.videosRemove, cacheMiddleware.cache(false), removeVideo)
router.get('/search/:name', reqValidator.videosSearch, cacheMiddleware.cache(false), searchVideos)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addVideo (req, res, next) {
  const video_file = req.files.input_video[0]
  const video_infos = req.body

  videos.seed(video_file.path, function (err, torrent) {
    if (err) {
      logger.error('Cannot seed this video.')
      return next(err)
    }

    const video_data = {
      name: video_infos.name,
      namePath: video_file.filename,
      description: video_infos.description,
      magnetUri: torrent.magnetURI
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
}

function getVideos (req, res, next) {
  Videos.get(req.params.id, function (err, video) {
    if (err) return next(err)

    if (video === null) {
      res.type('json').status(204).end()
    }

    res.json(video)
  })
}

function listVideos (req, res, next) {
  Videos.list(function (err, videos_list) {
    if (err) return next(err)

    res.json(videos_list)
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

    res.json(videos_list)
  })
}

// ---------------------------------------------------------------------------

// Maybe the torrent is not seeded, but we catch the error to don't stop the removing process
function removeTorrent (magnetUri, callback) {
  try {
    webtorrent.remove(magnetUri, callback)
  } catch (err) {
    logger.warn('Cannot remove the torrent from WebTorrent', { err: err })
    return callback(null)
  }
}
