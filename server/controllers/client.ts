import { constants, promises as fs } from 'fs'
import * as express from 'express'
import { join } from 'path'
import { root } from '../helpers/core-utils'
import { ACCEPT_HEADERS, STATIC_MAX_AGE } from '../initializers/constants'
import { asyncMiddleware, embedCSP } from '../middlewares'
import { buildFileLocale, getCompleteLocale, is18nLocale, LOCALE_FILES } from '../../shared/models/i18n/i18n'
import { ClientHtml } from '../lib/client-html'
import { logger } from '../helpers/logger'
import { CONFIG } from '@server/initializers/config'

const clientsRouter = express.Router()

const distPath = join(root(), 'client', 'dist')
const embedPath = join(distPath, 'standalone', 'videos', 'embed.html')
const testEmbedPath = join(distPath, 'standalone', 'videos', 'test-embed.html')

// Special route that add OpenGraph and oEmbed tags
// Do not use a template engine for a so little thing
clientsRouter.use('/videos/watch/:id', asyncMiddleware(generateWatchHtmlPage))
clientsRouter.use('/accounts/:nameWithHost', asyncMiddleware(generateAccountHtmlPage))
clientsRouter.use('/video-channels/:nameWithHost', asyncMiddleware(generateVideoChannelHtmlPage))

const embedCSPMiddleware = CONFIG.CSP.ENABLED
  ? embedCSP
  : (req: express.Request, res: express.Response, next: express.NextFunction) => next()

clientsRouter.use(
  '/videos/embed',
  embedCSPMiddleware,
  (req: express.Request, res: express.Response) => {
    res.removeHeader('X-Frame-Options')
    // Don't cache HTML file since it's an index to the immutable JS/CSS files
    res.sendFile(embedPath, { maxAge: 0 })
  }
)
clientsRouter.use(
  '/videos/test-embed',
  (req: express.Request, res: express.Response) => res.sendFile(testEmbedPath)
)

// Static HTML/CSS/JS client files
const staticClientFiles = [
  'ngsw-worker.js',
  'ngsw.json'
]

for (const staticClientFile of staticClientFiles) {
  const path = join(root(), 'client', 'dist', staticClientFile)

  clientsRouter.get(`/${staticClientFile}`, (req: express.Request, res: express.Response) => {
    res.sendFile(path, { maxAge: STATIC_MAX_AGE.SERVER })
  })
}

// Dynamic PWA manifest
clientsRouter.get('/manifest.webmanifest', asyncMiddleware(generateManifest))

// Static client overrides
const staticClientOverrides = [
  'assets/images/logo.svg',
  'assets/images/favicon.png',
  'assets/images/icons/icon-36x36.png',
  'assets/images/icons/icon-48x48.png',
  'assets/images/icons/icon-72x72.png',
  'assets/images/icons/icon-96x96.png',
  'assets/images/icons/icon-144x144.png',
  'assets/images/icons/icon-192x192.png',
  'assets/images/icons/icon-512x512.png'
]

for (const staticClientOverride of staticClientOverrides) {
  const overridePhysicalPath = join(CONFIG.STORAGE.CLIENT_OVERRIDES_DIR, staticClientOverride)
  clientsRouter.use(`/client/${staticClientOverride}`, asyncMiddleware(serveClientOverride(overridePhysicalPath)))
}

clientsRouter.use('/client/locales/:locale/:file.json', serveServerTranslations)
clientsRouter.use('/client', express.static(distPath, { maxAge: STATIC_MAX_AGE.CLIENT }))

// 404 for static files not found
clientsRouter.use('/client/*', (req: express.Request, res: express.Response) => {
  res.sendStatus(404)
})

// Always serve index client page (the client is a single page application, let it handle routing)
// Try to provide the right language index.html
clientsRouter.use('/(:language)?', asyncMiddleware(serveIndexHTML))

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

    const path = join(__dirname, `../../../client/dist/locale/${file}.${completeFileLocale}.json`)
    return res.sendFile(path, { maxAge: STATIC_MAX_AGE.SERVER })
  }

  return res.sendStatus(404)
}

async function serveIndexHTML (req: express.Request, res: express.Response) {
  if (req.accepts(ACCEPT_HEADERS) === 'html') {
    try {
      await generateHTMLPage(req, res, req.params.language)
      return
    } catch (err) {
      logger.error('Cannot generate HTML page.', err)
    }
  }

  return res.status(404).end()
}

async function generateHTMLPage (req: express.Request, res: express.Response, paramLang?: string) {
  const html = await ClientHtml.getDefaultHTMLPage(req, res, paramLang)

  return sendHTML(html, res)
}

async function generateWatchHtmlPage (req: express.Request, res: express.Response) {
  const html = await ClientHtml.getWatchHTMLPage(req.params.id + '', req, res)

  return sendHTML(html, res)
}

async function generateAccountHtmlPage (req: express.Request, res: express.Response) {
  const html = await ClientHtml.getAccountHTMLPage(req.params.nameWithHost, req, res)

  return sendHTML(html, res)
}

async function generateVideoChannelHtmlPage (req: express.Request, res: express.Response) {
  const html = await ClientHtml.getVideoChannelHTMLPage(req.params.nameWithHost, req, res)

  return sendHTML(html, res)
}

function sendHTML (html: string, res: express.Response) {
  res.set('Content-Type', 'text/html; charset=UTF-8')

  return res.send(html)
}

async function generateManifest (req: express.Request, res: express.Response) {
  const manifestPhysicalPath = join(root(), 'client', 'dist', 'manifest.webmanifest')
  const manifestJson = await fs.readFile(manifestPhysicalPath, 'utf8')
  const manifest = JSON.parse(manifestJson)

  manifest.name = CONFIG.INSTANCE.NAME
  manifest.short_name = CONFIG.INSTANCE.NAME
  manifest.description = CONFIG.INSTANCE.SHORT_DESCRIPTION

  res.json(manifest)
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
