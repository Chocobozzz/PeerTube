import * as express from 'express'
import { join } from 'path'
import * as validator from 'validator'
import * as Bluebird from 'bluebird'

import { database as db } from '../initializers/database'
import {
  CONFIG,
  STATIC_PATHS,
  STATIC_MAX_AGE,
  OPENGRAPH_AND_OEMBED_COMMENT,
  EMBED_SIZE
} from '../initializers'
import { root, readFileBufferPromise, escapeHTML } from '../helpers'
import { asyncMiddleware } from '../middlewares'
import { VideoInstance } from '../models'

const clientsRouter = express.Router()

const distPath = join(root(), 'client', 'dist')
const embedPath = join(distPath, 'standalone', 'videos', 'embed.html')
const indexPath = join(distPath, 'index.html')

// Special route that add OpenGraph and oEmbed tags
// Do not use a template engine for a so little thing
clientsRouter.use('/videos/watch/:id',
  asyncMiddleware(generateWatchHtmlPage)
)

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

function addOpenGraphAndOEmbedTags (htmlStringPage: string, video: VideoInstance) {
  const previewUrl = CONFIG.WEBSERVER.URL + STATIC_PATHS.PREVIEWS + video.getPreviewName()
  const videoUrl = CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid

  const videoName = escapeHTML(video.name)
  const videoDescription = escapeHTML(video.description)
  const embedUrl = CONFIG.WEBSERVER.URL + video.getEmbedPath()

  const openGraphMetaTags = {
    'og:type': 'video',
    'og:title': videoName,
    'og:image': previewUrl,
    'og:url': videoUrl,
    'og:description': videoDescription,

    'og:video:url': embedUrl,
    'og:video:secure_url': embedUrl,
    'og:video:type': 'text/html',
    'og:video:width': EMBED_SIZE.width,
    'og:video:height': EMBED_SIZE.height,

    'name': videoName,
    'description': videoDescription,
    'image': previewUrl,

    'twitter:card': 'summary_large_image',
    'twitter:site': '@Chocobozzz',
    'twitter:title': videoName,
    'twitter:description': videoDescription,
    'twitter:image': previewUrl,
    'twitter:player': embedUrl,
    'twitter:player:width': EMBED_SIZE.width,
    'twitter:player:height': EMBED_SIZE.height
  }

  const oembedLinkTags = [
    {
      type: 'application/json+oembed',
      href: CONFIG.WEBSERVER.URL + '/services/oembed?url=' + encodeURIComponent(videoUrl),
      title: videoName
    }
  ]

  let tagsString = ''
  Object.keys(openGraphMetaTags).forEach(tagName => {
    const tagValue = openGraphMetaTags[tagName]

    tagsString += `<meta property="${tagName}" content="${tagValue}" />`
  })

  for (const oembedLinkTag of oembedLinkTags) {
    tagsString += `<link rel="alternate" type="${oembedLinkTag.type}" href="${oembedLinkTag.href}" title="${oembedLinkTag.title}" />`
  }

  return htmlStringPage.replace(OPENGRAPH_AND_OEMBED_COMMENT, tagsString)
}

async function generateWatchHtmlPage (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = '' + req.params.id
  let videoPromise: Bluebird<VideoInstance>

  // Let Angular application handle errors
  if (validator.isUUID(videoId, 4)) {
    videoPromise = db.Video.loadByUUIDAndPopulateAccountAndServerAndTags(videoId)
  } else if (validator.isInt(videoId)) {
    videoPromise = db.Video.loadAndPopulateAccountAndServerAndTags(+videoId)
  } else {
    return res.sendFile(indexPath)
  }

  let [ file, video ] = await Promise.all([
    readFileBufferPromise(indexPath),
    videoPromise
  ])

  const html = file.toString()

  // Let Angular application handle errors
  if (!video) return res.sendFile(indexPath)

  const htmlStringPageWithTags = addOpenGraphAndOEmbedTags(html, video)
  res.set('Content-Type', 'text/html; charset=UTF-8').send(htmlStringPageWithTags)
}
