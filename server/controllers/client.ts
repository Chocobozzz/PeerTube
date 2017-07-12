import * as express from 'express'
import { join } from 'path'
import * as validator from 'validator'
import * as Promise from 'bluebird'

import { database as db } from '../initializers/database'
import {
  CONFIG,
  STATIC_PATHS,
  STATIC_MAX_AGE,
  OPENGRAPH_COMMENT
} from '../initializers'
import { root, readFileBufferPromise } from '../helpers'
import { VideoInstance } from '../models'

const clientsRouter = express.Router()

const distPath = join(root(), 'client', 'dist')
const embedPath = join(distPath, 'standalone', 'videos', 'embed.html')
const indexPath = join(distPath, 'index.html')

// Special route that add OpenGraph tags
// Do not use a template engine for a so little thing
clientsRouter.use('/videos/watch/:id', generateWatchHtmlPage)

clientsRouter.use('/videos/embed', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.sendFile(embedPath)
})

// Static HTML/CSS/JS client files
clientsRouter.use('/client', express.static(distPath, { maxAge: STATIC_MAX_AGE }))

// 404 for static files not found
clientsRouter.use('/client/*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.sendStatus(404)
})

// ---------------------------------------------------------------------------

export {
  clientsRouter
}

// ---------------------------------------------------------------------------

function addOpenGraphTags (htmlStringPage: string, video: VideoInstance) {
  const previewUrl = CONFIG.WEBSERVER.URL + STATIC_PATHS.PREVIEWS + video.getPreviewName()
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
  Object.keys(metaTags).forEach(tagName => {
    const tagValue = metaTags[tagName]

    tagsString += '<meta property="' + tagName + '" content="' + tagValue + '" />'
  })

  return htmlStringPage.replace(OPENGRAPH_COMMENT, tagsString)
}

function generateWatchHtmlPage (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = '' + req.params.id
  let videoPromise: Promise<VideoInstance>

  // Let Angular application handle errors
  if (validator.isUUID(videoId, 4)) {
    videoPromise = db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(videoId)
  } else if (validator.isInt(videoId)) {
    videoPromise = db.Video.loadAndPopulateAuthorAndPodAndTags(+videoId)
  } else {
    return res.sendFile(indexPath)
  }

  Promise.all([
    readFileBufferPromise(indexPath),
    videoPromise
  ])
  .then(([ file, video ]) => {
    file = file as Buffer
    video = video as VideoInstance

    const html = file.toString()

    // Let Angular application handle errors
    if (!video) return res.sendFile(indexPath)

    const htmlStringPageWithTags = addOpenGraphTags(html, video)
    res.set('Content-Type', 'text/html; charset=UTF-8').send(htmlStringPageWithTags)
  })
  .catch(err => next(err))
}
