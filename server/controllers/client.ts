import * as express from 'express'
import { join } from 'path'
import { root } from '../helpers/core-utils'
import { ACCEPT_HEADERS, STATIC_MAX_AGE } from '../initializers'
import { asyncMiddleware } from '../middlewares'
import { buildFileLocale, getCompleteLocale, is18nLocale, LOCALE_FILES } from '../../shared/models/i18n/i18n'
import { ClientHtml } from '../lib/client-html'
import { logger } from '../helpers/logger'

const clientsRouter = express.Router()

const distPath = join(root(), 'client', 'dist')
const assetsImagesPath = join(root(), 'client', 'dist', 'assets', 'images')
const embedPath = join(distPath, 'standalone', 'videos', 'embed.html')
const testEmbedPath = join(distPath, 'standalone', 'videos', 'test-embed.html')

// Special route that add OpenGraph and oEmbed tags
// Do not use a template engine for a so little thing
clientsRouter.use('/videos/watch/:id',
  asyncMiddleware(generateWatchHtmlPage)
)

clientsRouter.use('' +
  '/videos/embed',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.removeHeader('X-Frame-Options')
    res.sendFile(embedPath)
  }
)
clientsRouter.use('' +
  '/videos/test-embed', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.sendFile(testEmbedPath)
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
clientsRouter.use('/(:language)?', async function (req, res) {
  if (req.accepts(ACCEPT_HEADERS) === 'html') {
    try {
      await generateHTMLPage(req, res, req.params.language)
      return
    } catch (err) {
      logger.error('Cannot generate HTML page.', err)
    }
  }

  return res.status(404).end()
})

// ---------------------------------------------------------------------------

export {
  clientsRouter
}

// ---------------------------------------------------------------------------

async function generateHTMLPage (req: express.Request, res: express.Response, paramLang?: string) {
  const html = await ClientHtml.getIndexHTML(req, res, paramLang)

  return sendHTML(html, res)
}

async function generateWatchHtmlPage (req: express.Request, res: express.Response) {
  const html = await ClientHtml.getWatchHTMLPage(req.params.id + '', req, res)

  return sendHTML(html, res)
}

function sendHTML (html: string, res: express.Response) {
  res.set('Content-Type', 'text/html; charset=UTF-8')

  return res.send(html)
}
