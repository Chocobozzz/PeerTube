import { parallel } from 'async'
import express = require('express')
import fs = require('fs')
import { join } from 'path'
import expressValidator = require('express-validator')
// TODO: use .validator when express-validator typing will have validator field
const validator = expressValidator['validator']

import { database as db } from '../initializers/database'
import {
  CONFIG,
  REMOTE_SCHEME,
  STATIC_PATHS,
  STATIC_MAX_AGE
} from '../initializers'
import { root } from '../helpers'

const clientsRouter = express.Router()

// TODO: move to constants
const opengraphComment = '<!-- opengraph tags -->'
const distPath = join(root(), 'client', 'dist')
const embedPath = join(distPath, 'standalone', 'videos', 'embed.html')
const indexPath = join(distPath, 'index.html')

// Special route that add OpenGraph tags
// Do not use a template engine for a so little thing
clientsRouter.use('/videos/watch/:id', generateWatchHtmlPage)

clientsRouter.use('/videos/embed', function (req, res, next) {
  res.sendFile(embedPath)
})

// Static HTML/CSS/JS client files
clientsRouter.use('/client', express.static(distPath, { maxAge: STATIC_MAX_AGE }))

// 404 for static files not found
clientsRouter.use('/client/*', function (req, res, next) {
  res.sendStatus(404)
})

// ---------------------------------------------------------------------------

export {
  clientsRouter
}

// ---------------------------------------------------------------------------

function addOpenGraphTags (htmlStringPage, video) {
  let basePreviewUrlHttp

  if (video.isOwned()) {
    basePreviewUrlHttp = CONFIG.WEBSERVER.URL
  } else {
    basePreviewUrlHttp = REMOTE_SCHEME.HTTP + '://' + video.Author.Pod.host
  }

  // We fetch the remote preview (bigger than the thumbnail)
  // This should not overhead the remote server since social websites put in a cache the OpenGraph tags
  // We can't use the thumbnail because these social websites want bigger images (> 200x200 for Facebook for example)
  const previewUrl = basePreviewUrlHttp + STATIC_PATHS.PREVIEWS + video.getPreviewName()
  const videoUrl = CONFIG.WEBSERVER.URL + '/videos/watch/' + video.id

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
  if (!validator.isUUID(videoId, 4)) return res.sendFile(indexPath)

  parallel({
    file: function (callback) {
      fs.readFile(indexPath, callback)
    },

    video: function (callback) {
      db.Video.loadAndPopulateAuthorAndPodAndTags(videoId, callback)
    }
  }, function (err, result: any) {
    if (err) return next(err)

    const html = result.file.toString()
    const video = result.video

    // Let Angular application handle errors
    if (!video) return res.sendFile(indexPath)

    const htmlStringPageWithTags = addOpenGraphTags(html, video)
    res.set('Content-Type', 'text/html; charset=UTF-8').send(htmlStringPageWithTags)
  })
}
