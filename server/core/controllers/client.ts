import { buildFileLocale, getCompleteLocale, is18nLocale, LOCALE_FILES } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { currentDir, root } from '@peertube/peertube-node-utils'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { getServerActor } from '@server/models/application/application.js'
import express from 'express'
import { constants, promises as fs } from 'fs'
import { join } from 'path'
import { STATIC_MAX_AGE } from '../initializers/constants.js'
import { ClientHtml, sendHTML, serveIndexHTML } from '../lib/html/client-html.js'
import { asyncMiddleware, buildRateLimiter, embedCSP } from '../middlewares/index.js'

const clientsRouter = express.Router()

const clientsRateLimiter = buildRateLimiter({
  windowMs: CONFIG.RATES_LIMIT.CLIENT.WINDOW_MS,
  max: CONFIG.RATES_LIMIT.CLIENT.MAX
})

const distPath = join(root(), 'client', 'dist')

// Special route that add OpenGraph and oEmbed tags
// Do not use a template engine for a so little thing
clientsRouter.use([ '/w/p/:id', '/videos/watch/playlist/:id' ], clientsRateLimiter, asyncMiddleware(generateWatchPlaylistHtmlPage))

clientsRouter.use([ '/w/:id', '/videos/watch/:id' ], clientsRateLimiter, asyncMiddleware(generateWatchHtmlPage))

clientsRouter.use([ '/accounts/:handle', '/a/:handle' ], clientsRateLimiter, asyncMiddleware(generateAccountHtmlPage))

clientsRouter.use([ '/video-channels/:handle', '/c/:handle' ], clientsRateLimiter, asyncMiddleware(generateVideoChannelHtmlPage))

clientsRouter.use('/@:handle', clientsRateLimiter, asyncMiddleware(generateActorHtmlPage))

// ---------------------------------------------------------------------------

const embedMiddlewares = [
  clientsRateLimiter,

  CONFIG.CSP.ENABLED
    ? embedCSP
    : (req: express.Request, res: express.Response, next: express.NextFunction) => next(),

  // Set headers
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.removeHeader('X-Frame-Options')

    // Don't cache HTML file since it's an index to the immutable JS/CSS files
    res.setHeader('Cache-Control', 'public, max-age=0')

    next()
  }
]

clientsRouter.use('/videos/embed/:id', ...embedMiddlewares, asyncMiddleware(generateVideoEmbedHtmlPage))
clientsRouter.use('/video-playlists/embed/:id', ...embedMiddlewares, asyncMiddleware(generateVideoPlaylistEmbedHtmlPage))

// ---------------------------------------------------------------------------

const testEmbedPath = join(distPath, 'standalone', 'videos', 'test-embed.html')
const testEmbedController = (req: express.Request, res: express.Response) => res.sendFile(testEmbedPath)

clientsRouter.use('/videos/test-embed', clientsRateLimiter, testEmbedController)
clientsRouter.use('/video-playlists/test-embed', clientsRateLimiter, testEmbedController)

// ---------------------------------------------------------------------------

// Dynamic PWA manifest
clientsRouter.get('/manifest.webmanifest', clientsRateLimiter, asyncMiddleware(generateManifest))

// Static client overrides
// Must be consistent with static client overrides redirections in /support/nginx/peertube
const staticClientOverrides = [
  'assets/images/default-playlist.jpg',
  'assets/images/default-avatar-account.png',
  'assets/images/default-avatar-account-48x48.png',
  'assets/images/default-avatar-video-channel.png',
  'assets/images/default-avatar-video-channel-48x48.png'
]

for (const staticClientOverride of staticClientOverrides) {
  const overridePhysicalPath = join(CONFIG.STORAGE.CLIENT_OVERRIDES_DIR, staticClientOverride)
  clientsRouter.use(`/client/${staticClientOverride}`, asyncMiddleware(serveClientOverride(overridePhysicalPath)))
}

clientsRouter.use('/client/locales/:locale/:file.json', serveServerTranslations)
clientsRouter.use('/client', express.static(distPath, { maxAge: STATIC_MAX_AGE.CLIENT }))

// 404 for static files not found
clientsRouter.use('/client/*', (req: express.Request, res: express.Response) => {
  res.status(HttpStatusCode.NOT_FOUND_404).end()
})

// Always serve index client page (the client is a single page application, let it handle routing)
// Try to provide the right language index.html
clientsRouter.use('/(:language)?', clientsRateLimiter, asyncMiddleware(serveIndexHTML))

// ---------------------------------------------------------------------------

export {
  clientsRouter
}

// ---------------------------------------------------------------------------

function serveServerTranslations (req: express.Request, res: express.Response) {
  const locale = req.params.locale
  const file = req.params.file

  if (is18nLocale(locale) && LOCALE_FILES.includes(file)) {
    const completeLocale = getCompleteLocale(locale)
    const completeFileLocale = buildFileLocale(completeLocale)

    const path = join(currentDir(import.meta.url), `../../../client/dist/locale/${file}.${completeFileLocale}.json`)
    return res.sendFile(path, { maxAge: STATIC_MAX_AGE.SERVER })
  }

  return res.status(HttpStatusCode.NOT_FOUND_404).end()
}

async function generateVideoEmbedHtmlPage (req: express.Request, res: express.Response) {
  req.params.id = toCompleteUUID(req.params.id)

  const allowParameters = { req }

  const allowedResult = await Hooks.wrapFun(
    isEmbedAllowed,
    allowParameters,
    'filter:html.embed.video.allowed.result'
  )

  if (allowedResult?.allowed !== true) {
    logger.info('Embed is not allowed.', { allowedResult })

    return sendHTML(allowedResult?.html || '', res)
  }

  const html = await ClientHtml.getVideoEmbedHTML(req.params.id)

  return sendHTML(html, res)
}

async function generateVideoPlaylistEmbedHtmlPage (req: express.Request, res: express.Response) {
  req.params.id = toCompleteUUID(req.params.id)

  const allowParameters = { req }

  const allowedResult = await Hooks.wrapFun(
    isEmbedAllowed,
    allowParameters,
    'filter:html.embed.video-playlist.allowed.result'
  )

  if (allowedResult?.allowed !== true) {
    logger.info('Embed is not allowed.', { allowedResult })

    return sendHTML(allowedResult?.html || '', res)
  }

  const html = await ClientHtml.getVideoPlaylistEmbedHTML(req.params.id)

  return sendHTML(html, res)
}

async function generateWatchHtmlPage (req: express.Request, res: express.Response) {
  // Thread link is '/w/:videoId;threadId=:threadId'
  // So to get the videoId we need to remove the last part
  let videoId = req.params.id + ''

  const threadIdIndex = videoId.indexOf(';threadId')
  if (threadIdIndex !== -1) videoId = videoId.substring(0, threadIdIndex)

  videoId = toCompleteUUID(videoId)

  const html = await ClientHtml.getWatchHTMLPage(videoId, req, res)

  return sendHTML(html, res, true)
}

async function generateWatchPlaylistHtmlPage (req: express.Request, res: express.Response) {
  req.params.id = toCompleteUUID(req.params.id)

  const html = await ClientHtml.getWatchPlaylistHTMLPage(req.params.id + '', req, res)

  return sendHTML(html, res, true)
}

async function generateAccountHtmlPage (req: express.Request, res: express.Response) {
  const html = await ClientHtml.getAccountHTMLPage(req.params.handle, req, res)

  return sendHTML(html, res, true)
}

async function generateVideoChannelHtmlPage (req: express.Request, res: express.Response) {
  const html = await ClientHtml.getVideoChannelHTMLPage(req.params.handle, req, res)

  return sendHTML(html, res, true)
}

async function generateActorHtmlPage (req: express.Request, res: express.Response) {
  const html = await ClientHtml.getActorHTMLPage(req.params.handle, req, res)

  return sendHTML(html, res, true)
}

async function generateManifest (req: express.Request, res: express.Response) {
  const serverActor = await getServerActor()

  const defaultIcons = [ 192, 512 ].map(size => {
    return {
      src: `/client/assets/images/icons/icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png'
    }
  })

  const icons = Array.isArray(serverActor.Avatars) && serverActor.Avatars.length > 0
    ? serverActor.Avatars.map(avatar => ({
      src: avatar.getStaticPath(),
      sizes: `${avatar.width}x${avatar.height}`,
      type: avatar.getMimeType()
    }))
    : defaultIcons

  return res.json({
    name: CONFIG.INSTANCE.NAME,
    short_name: CONFIG.INSTANCE.NAME,
    start_url: '/',
    background_color: '#fff',
    theme_color: '#fff',
    description: CONFIG.INSTANCE.SHORT_DESCRIPTION,
    display: 'standalone',
    icons
  })
}

function serveClientOverride (path: string) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      await fs.access(path, constants.F_OK)
      // Serve override client
      res.sendFile(path, { maxAge: STATIC_MAX_AGE.SERVER })
    } catch {
      // Serve dist client
      next()
    }
  }
}

type AllowedResult = { allowed: boolean, html?: string }
function isEmbedAllowed (_object: {
  req: express.Request
}): AllowedResult {
  return { allowed: true }
}
