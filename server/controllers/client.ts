import * as Bluebird from 'bluebird'
import * as express from 'express'
import { join } from 'path'
import * as validator from 'validator'
import { escapeHTML, readFileBufferPromise, root } from '../helpers/core-utils'
import { ACCEPT_HEADERS, CONFIG, EMBED_SIZE, OPENGRAPH_AND_OEMBED_COMMENT, STATIC_MAX_AGE, STATIC_PATHS } from '../initializers'
import { asyncMiddleware } from '../middlewares'
import { VideoModel } from '../models/video/video'
import { VideoPrivacy } from '../../shared/models/videos'
import { buildFileLocale, getCompleteLocale, getDefaultLocale, is18nLocale } from '../../shared/models'
import { LOCALE_FILES } from '../../shared/models/i18n/i18n'

const clientsRouter = express.Router()

const distPath = join(root(), 'client', 'dist')
const assetsImagesPath = join(root(), 'client', 'dist', 'assets', 'images')
const embedPath = join(distPath, 'standalone', 'videos', 'embed.html')

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

clientsRouter.use('/client/locales/:locale/:file.json', function (req, res) {
  const locale = req.params.locale
  const file = req.params.file

  if (is18nLocale(locale) && LOCALE_FILES.indexOf(file) !== -1) {
    const completeLocale = getCompleteLocale(locale)
    const completeFileLocale = buildFileLocale(completeLocale)
    return res.sendFile(join(__dirname, `../../../client/dist/locale/${file}_${completeFileLocale}.json`))
  }

  return res.sendStatus(404)
})

// 404 for static files not found
clientsRouter.use('/client/*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.sendStatus(404)
})

// Always serve index client page (the client is a single page application, let it handle routing)
// Try to provide the right language index.html
clientsRouter.use('/(:language)?', function (req, res) {
  if (req.accepts(ACCEPT_HEADERS) === 'html') {
    return res.sendFile(getIndexPath(req, req.params.language))
  }

  return res.status(404).end()
})

// ---------------------------------------------------------------------------

export {
  clientsRouter
}

// ---------------------------------------------------------------------------

function getIndexPath (req: express.Request, paramLang?: string) {
  let lang: string

  // Check param lang validity
  if (paramLang && is18nLocale(paramLang)) {
    lang = paramLang
  } else {
    // lang = req.acceptsLanguages(POSSIBLE_LOCALES) || getDefaultLocale()
    // Disable auto language for now
    lang = getDefaultLocale()
  }

  return join(__dirname, '../../../client/dist/' + buildFileLocale(lang) + '/index.html')
}

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
    return res.sendFile(getIndexPath(req))
  }

  let [ file, video ] = await Promise.all([
    readFileBufferPromise(getIndexPath(req)),
    videoPromise
  ])

  const html = file.toString()

  // Let Angular application handle errors
  if (!video || video.privacy === VideoPrivacy.PRIVATE) return res.sendFile(getIndexPath(req))

  const htmlStringPageWithTags = addOpenGraphAndOEmbedTags(html, video)
  res.set('Content-Type', 'text/html; charset=UTF-8').send(htmlStringPageWithTags)
}
