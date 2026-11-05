import {
  AVAILABLE_LOCALES,
  buildFileLocale,
  escapeHTML,
  escapeHtmlJSONStr,
  getDefaultLocale,
  is18nLocale
} from '@peertube/peertube-core-utils'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { isTestOrDevInstance, root, sha256 } from '@peertube/peertube-node-utils'
import { setClientLanguageCookie } from '@server/helpers/i18n.js'
import { CONFIG } from '@server/initializers/config.js'
import { getInstanceInformation } from '@server/lib/instance-translation.js'
import { getDefaultRSSFeeds } from '@server/lib/rss.js'
import { getServerActor } from '@server/models/application/application.js'
import express from 'express'
import { pathExists } from 'fs-extra/esm'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createLogger } from '../../../helpers/logger.js'
import { CUSTOM_HTML_TAG_COMMENTS, FILES_CONTENT_HASH, PLUGIN_GLOBAL_CSS_PATH, WEBSERVER } from '../../../initializers/constants.js'
import { ServerConfigManager } from '../../server-config-manager.js'
import { TagsHtml } from './tags-html.js'

const logger = createLogger()

const NOINDEX_CLIENT_PATHS = [
  '/admin',
  '/login',
  '/manage',
  '/my-account',
  '/my-library',
  '/remote-interaction',
  '/reset-password',
  '/search',
  '/signup',
  '/stats',
  '/studio',
  '/verify-account',
  '/videos/manage',
  '/videos/publish',
  '/videos/subscriptions',
  '/videos/update',
  '/videos/upload'
]

export class PageHtml {
  private static htmlCache: { [path: string]: string } = {}

  static invalidateCache () {
    logger.info('Cleaning HTML cache.')

    this.htmlCache = {}
  }

  static async getDefaultHTML (req: express.Request, res: express.Response, paramLang?: string) {
    const language = this.getIndexHTMLLanguage(req, res, paramLang)

    const html = await this.getIndexHTMLOfLanguage(language)
    const serverActor = await getServerActor()

    const openGraphImage = ServerConfigManager.Instance.getDefaultOpenGraph(serverActor)
    const { shortDescription } = getInstanceInformation(language)

    let customHTML = TagsHtml.addTitleTag(html)
    customHTML = TagsHtml.addDescriptionTag(customHTML, escapeHTML(shortDescription))
    customHTML = TagsHtml.addServerRenderedContent(customHTML, {
      escapedTitle: escapeHTML(CONFIG.INSTANCE.NAME),
      markdownDescription: shortDescription
    })

    // Query parameters only filter/sort the page content: don't consider them as different pages
    const { pathname } = new URL(req.originalUrl, WEBSERVER.URL)

    const url = pathname === '/'
      ? WEBSERVER.URL
      : WEBSERVER.URL + pathname

    customHTML = await TagsHtml.addTags(customHTML, {
      url,

      escapedSiteName: escapeHTML(CONFIG.INSTANCE.NAME),
      escapedTitle: escapeHTML(CONFIG.INSTANCE.NAME),
      escapedTruncatedDescription: escapeHTML(shortDescription),

      relMe: url === WEBSERVER.URL
        ? this.findInstanceRelMe()
        : undefined,

      image: openGraphImage
        ? { url: openGraphImage.fileUrl, width: openGraphImage.width, height: openGraphImage.height }
        : undefined,

      ogType: 'website',
      twitterCard: 'summary_large_image',
      forbidIndexation: NOINDEX_CLIENT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')),
      embedIndexation: false,
      rssFeeds: getDefaultRSSFeeds(req)
    }, {})

    return customHTML
  }

  static async getEmbedHTML () {
    const path = this.getEmbedHTMLPath()

    // Disable HTML cache in dev mode because Vite can regenerate JS files
    if (!isTestOrDevInstance() && this.htmlCache[path]) {
      return this.htmlCache[path]
    }

    const buffer = await readFile(path)
    const serverConfig = await ServerConfigManager.Instance.getHTMLServerConfig()

    let html = buffer.toString()
    html = await this.addAsyncPluginCSS(html)
    html = this.addCustomCSS(html)
    html = this.addServerConfig(html, serverConfig)

    this.htmlCache[path] = html

    return html
  }

  // ---------------------------------------------------------------------------

  static getIndexHTML (req: express.Request, res: express.Response, paramLang?: string) {
    return this.getIndexHTMLOfLanguage(this.getIndexHTMLLanguage(req, res, paramLang))
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  // Cached per language: the server config includes instance information translated in this language
  private static async getIndexHTMLOfLanguage (language: string) {
    const path = join(root(), 'client', 'dist', language, 'index.html')
    if (this.htmlCache[path]) return this.htmlCache[path]

    const buffer = await readFile(path)
    const serverConfig = await ServerConfigManager.Instance.getHTMLServerConfig(language)

    let html = buffer.toString()

    html = this.addManifestContentHash(html)

    html = this.addCustomCSS(html)
    html = this.addServerConfig(html, serverConfig)
    html = await this.addAsyncPluginCSS(html)

    this.htmlCache[path] = html

    return html
  }

  private static getEmbedHTMLPath () {
    return join(root(), 'client', 'dist', 'standalone', 'videos', 'embed.html')
  }

  private static getIndexHTMLLanguage (req: express.Request, res: express.Response, paramLang: string) {
    let lang: string

    // Check param lang validity
    if (paramLang && is18nLocale(paramLang)) {
      lang = paramLang

      // Save locale in cookies
      setClientLanguageCookie(res, lang)
    } else if (req.cookies.clientLanguage && is18nLocale(req.cookies.clientLanguage)) {
      lang = req.cookies.clientLanguage
    } else {
      lang = req.acceptsLanguages(AVAILABLE_LOCALES) || getDefaultLocale()
    }

    logger.debug(
      'Serving %s HTML language',
      buildFileLocale(lang),
      { cookie: req.cookies?.clientLanguage, paramLang, acceptLanguage: req.headers['accept-language'] }
    )

    return buildFileLocale(lang)
  }

  private static findInstanceRelMe () {
    const descriptions = [ CONFIG.INSTANCE.DESCRIPTION, ...CONFIG.INSTANCE.TRANSLATIONS.map(t => t.description) ]

    return [ ...new Set(descriptions.flatMap(d => TagsHtml.findRelMe(d) ?? [])) ]
  }

  // ---------------------------------------------------------------------------

  static addCustomCSS (htmlStringPage: string) {
    const styleTag = `<style class="custom-css-style">${CONFIG.INSTANCE.CUSTOMIZATIONS.CSS}</style>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.CUSTOM_CSS, styleTag)
  }

  static addServerConfig (htmlStringPage: string, serverConfig: HTMLServerConfig) {
    // Stringify the JSON object, and then stringify the string object so we can inject it into the HTML
    const serverConfigString = JSON.stringify(JSON.stringify(serverConfig))
    const configScriptTag = `<script type="application/javascript">` +
      `window.PeerTubeServerConfig = ${escapeHtmlJSONStr(serverConfigString)}` +
      `</script>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.SERVER_CONFIG, configScriptTag)
  }

  static async addAsyncPluginCSS (htmlStringPage: string) {
    if (!await pathExists(PLUGIN_GLOBAL_CSS_PATH)) {
      logger.info('Plugin Global CSS file is not available (generation may still be in progress), ignoring it.')
      return htmlStringPage
    }

    let globalCSSContent: Buffer

    try {
      globalCSSContent = await readFile(PLUGIN_GLOBAL_CSS_PATH)
    } catch (err) {
      logger.error('Error retrieving the Plugin Global CSS file, ignoring it.', { err })
      return htmlStringPage
    }

    if (globalCSSContent.byteLength === 0) return htmlStringPage

    const fileHash = sha256(globalCSSContent)
    const linkTag = `<link rel="stylesheet" href="/plugins/global.css?hash=${fileHash}" />`

    return htmlStringPage.replace('</head>', linkTag + '</head>')
  }

  private static addManifestContentHash (htmlStringPage: string) {
    return htmlStringPage.replace('[manifestContentHash]', FILES_CONTENT_HASH.MANIFEST)
  }
}
