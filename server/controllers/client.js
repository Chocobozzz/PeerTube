'use strict'

const parallel = require('async/parallel')
const express = require('express')
const fs = require('fs')
const mongoose = require('mongoose')
const path = require('path')
const validator = require('express-validator').validator

const constants = require('../initializers/constants')

const Video = mongoose.model('Video')
const router = express.Router()

const opengraphComment = '<!-- opengraph tags -->'
const embedPath = path.join(__dirname, '../../client/dist/standalone/videos/embed.html')
const indexPath = path.join(__dirname, '../../client/dist/index.html')

// Special route that add OpenGraph tags
// Do not use a template engine for a so little thing
router.use('/videos/watch/:id', generateWatchHtmlPage)

router.use('/videos/embed', function (req, res, next) {
  res.sendFile(embedPath)
})

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addOpenGraphTags (htmlStringPage, video) {
  const videoUrl = constants.CONFIG.WEBSERVER.URL + '/videos/watch/'
  let baseUrlHttp

  if (video.isOwned()) {
    baseUrlHttp = constants.CONFIG.WEBSERVER.URL
  } else {
    baseUrlHttp = constants.REMOTE_SCHEME.HTTP + '://' + video.podHost
  }

  // We fetch the remote preview (bigger than the thumbnail)
  // This should not overhead the remote server since social websites put in a cache the OpenGraph tags
  // We can't use the thumbnail because these social websites want bigger images (> 200x200 for Facebook for example)
  const previewUrl = baseUrlHttp + constants.STATIC_PATHS.PREVIEWS + video.getPreviewName()

  const metaTags = {
    'og:type': 'video',
    'og:title': video.name,
    'og:image': previewUrl,
    'og:url': videoUrl,
    'og:description': video.description,

    'name': video.name,
    'description': video.description,
    'image': previewUrl,

    'twitter:card': 'summary_large_image',
    'twitter:site': '@Chocobozzz',
    'twitter:title': video.name,
    'twitter:description': video.description,
    'twitter:image': previewUrl
  }

  let tagsString = ''
  Object.keys(metaTags).forEach(function (tagName) {
    const tagValue = metaTags[tagName]

    tagsString += '<meta property="' + tagName + '" content="' + tagValue + '" />'
  })

  return htmlStringPage.replace(opengraphComment, tagsString)
}

function generateWatchHtmlPage (req, res, next) {
  const videoId = req.params.id

  // Let Angular application handle errors
  if (!validator.isMongoId(videoId)) return res.sendFile(indexPath)

  parallel({
    file: function (callback) {
      fs.readFile(indexPath, callback)
    },

    video: function (callback) {
      Video.load(videoId, callback)
    }
  }, function (err, results) {
    if (err) return next(err)

    const html = results.file.toString()
    const video = results.video

    // Let Angular application handle errors
    if (!video) return res.sendFile(indexPath)

    const htmlStringPageWithTags = addOpenGraphTags(html, video)
    res.set('Content-Type', 'text/html; charset=UTF-8').send(htmlStringPageWithTags)
  })
}
