import * as Bluebird from 'bluebird'
import * as express from 'express'
import { join } from 'path'
import * as validator from 'validator'
import { escapeHTML, readFileBufferPromise, root } from '../helpers/core-utils'
import { CONFIG, EMBED_SIZE, OPENGRAPH_AND_OEMBED_COMMENT, STATIC_MAX_AGE, STATIC_PATHS } from '../initializers'
import { asyncMiddleware } from '../middlewares'
import { VideoModel } from '../models/video/video'

const clientsRouter = express.Router()

const distPath = join(root(), 'client', 'dist')
const assetsImagesPath = join(root(), 'client', 'dist', 'assets', 'images')
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

const staticClientFiles = [
  'manifest.json',
  'ngsw-worker.js',
  'ngsw.json'
]
for (const staticClientFile of staticClientFiles) {
  const path = join(root(), 'client', 'dist', staticClientFile)
  clientsRouter.use('/' + staticClientFile, express.static(path, { maxAge: STATIC_MAX_AGE }))
}

clientsRouter.use('/client', express.static(distPath, { maxAge: STATIC_MAX_AGE }))
clientsRouter.use('/client/assets/images', express.static(assetsImagesPath, { maxAge: STATIC_MAX_AGE }))

// 404 for static files not found
clientsRouter.use('/client/*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.sendStatus(404)
})

// ---------------------------------------------------------------------------

export {
  clientsRouter
}

// ---------------------------------------------------------------------------

function addOpenGraphAndOEmbedTags (htmlStringPage: string, video: VideoModel) {
  const previewUrl = CONFIG.WEBSERVER.URL + STATIC_PATHS.PREVIEWS + video.getPreviewName()
  const videoUrl = CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid

  const videoNameEscaped = escapeHTML(video.name)
  const videoDescriptionEscaped = escapeHTML(video.description)
  const embedUrl = CONFIG.WEBSERVER.URL + video.getEmbedPath()

  const openGraphMetaTags = {
    'og:type': 'video',
    'og:title': videoNameEscaped,
    'og:image': previewUrl,
    'og:url': videoUrl,
    'og:description': videoDescriptionEscaped,

    'og:video:url': embedUrl,
    'og:video:secure_url': embedUrl,
    'og:video:type': 'text/html',
    'og:video:width': EMBED_SIZE.width,
    'og:video:height': EMBED_SIZE.height,

    'name': videoNameEscaped,
    'description': videoDescriptionEscaped,
    'image': previewUrl,

    'twitter:card': CONFIG.SERVICES.TWITTER.WHITELISTED ? 'player' : 'summary_large_image',
    'twitter:site': CONFIG.SERVICES.TWITTER.USERNAME,
    'twitter:title': videoNameEscaped,
    'twitter:description': videoDescriptionEscaped,
    'twitter:image': previewUrl,
    'twitter:player': embedUrl,
    'twitter:player:width': EMBED_SIZE.width,
    'twitter:player:height': EMBED_SIZE.height
  }

  const oembedLinkTags = [
    {
      type: 'application/json+oembed',
      href: CONFIG.WEBSERVER.URL + '/services/oembed?url=' + encodeURIComponent(videoUrl),
      title: videoNameEscaped
    }
  ]

  const schemaTags = {
    '@context': 'http://schema.org',
    '@type': 'VideoObject',
    name: videoNameEscaped,
    description: videoDescriptionEscaped,
    thumbnailUrl: previewUrl,
    uploadDate: video.createdAt.toISOString(),
    duration: video.getActivityStreamDuration(),
    contentUrl: videoUrl,
    embedUrl: embedUrl,
    interactionCount: video.views
  }

  let tagsString = ''

  // Opengraph
  Object.keys(openGraphMetaTags).forEach(tagName => {
    const tagValue = openGraphMetaTags[tagName]

    tagsString += `<meta property="${tagName}" content="${tagValue}" />`
  })

  // OEmbed
  for (const oembedLinkTag of oembedLinkTags) {
    tagsString += `<link rel="alternate" type="${oembedLinkTag.type}" href="${oembedLinkTag.href}" title="${oembedLinkTag.title}" />`
  }

  // Schema.org
  tagsString += `<script type="application/ld+json">${JSON.stringify(schemaTags)}</script>`

  // SEO
  tagsString += `<link rel="canonical" href="${videoUrl}" />`

  return htmlStringPage.replace(OPENGRAPH_AND_OEMBED_COMMENT, tagsString)
}

async function generateWatchHtmlPage (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = '' + req.params.id
  let videoPromise: Bluebird<VideoModel>

  // Let Angular application handle errors
  if (validator.isUUID(videoId, 4)) {
    videoPromise = VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(videoId)
  } else if (validator.isInt(videoId)) {
    videoPromise = VideoModel.loadAndPopulateAccountAndServerAndTags(+videoId)
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
