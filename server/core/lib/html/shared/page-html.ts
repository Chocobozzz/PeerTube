import { buildFileLocale, getDefaultLocale, is18nLocale, POSSIBLE_LOCALES } from '@peertube/peertube-core-utils'
import { isTestOrDevInstance, root, sha256 } from '@peertube/peertube-node-utils'
import express from 'express'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '../../../helpers/logger.js'
import { CUSTOM_HTML_TAG_COMMENTS, FILES_CONTENT_HASH, PLUGIN_GLOBAL_CSS_PATH } from '../../../initializers/constants.js'
import { ServerConfigManager } from '../../server-config-manager.js'
import { TagsHtml } from './tags-html.js'
import { pathExists } from 'fs-extra/esm'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'

export class PageHtml {

  private static htmlCache: { [path: string]: string } = {}

  static invalidateCache () {
    logger.info('Cleaning HTML cache.')

    this.htmlCache = {}
  }

  static async getDefaultHTML (req: express.Request, res: express.Response, paramLang?: string) {
    const html = paramLang
      ? await this.getIndexHTML(req, res, paramLang)
      : await this.getIndexHTML(req, res)

    let customHTML = TagsHtml.addTitleTag(html)
    customHTML = TagsHtml.addDescriptionTag(customHTML)

    return customHTML
  }

  static async getEmbedHTML () {
    const path = this.getEmbedHTMLPath()

    // Disable HTML cache in dev mode because webpack can regenerate JS files
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

  static async getIndexHTML (req: express.Request, res: express.Response, paramLang?: string) {
    const path = this.getIndexHTMLPath(req, res, paramLang)
    if (this.htmlCache[path]) return this.htmlCache[path]

    const buffer = await readFile(path)
    const serverConfig = await ServerConfigManager.Instance.getHTMLServerConfig()

    let html = buffer.toString()

    html = this.addManifestContentHash(html)
    html = this.addFaviconContentHash(html)
    html = this.addLogoContentHash(html)

    html = this.addCustomCSS(html)
    html = this.addServerConfig(html, serverConfig)
    html = await this.addAsyncPluginCSS(html)

    this.htmlCache[path] = html

    return html
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private static getEmbedHTMLPath () {
    return join(root(), 'client', 'dist', 'standalone', 'videos', 'embed.html')
  }

  private static getIndexHTMLPath (req: express.Request, res: express.Response, paramLang: string) {
    let lang: string

    // Check param lang validity
    if (paramLang && is18nLocale(paramLang)) {
      lang = paramLang

      // Save locale in cookies
      res.cookie('clientLanguage', lang, {
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 3600 * 24 * 90 // 3 months
      })

    } else if (req.cookies.clientLanguage && is18nLocale(req.cookies.clientLanguage)) {
      lang = req.cookies.clientLanguage
    } else {
      lang = req.acceptsLanguages(POSSIBLE_LOCALES) || getDefaultLocale()
    }

    logger.debug(
      'Serving %s HTML language', buildFileLocale(lang),
      { cookie: req.cookies?.clientLanguage, paramLang, acceptLanguage: req.headers['accept-language'] }
    )

    return join(root(), 'client', 'dist', buildFileLocale(lang), 'index.html')
  }

  // ---------------------------------------------------------------------------

  static addCustomCSS (htmlStringPage: string) {
    const styleTag = `<style class="custom-css-style">${CONFIG.INSTANCE.CUSTOMIZATIONS.CSS}</style>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.CUSTOM_CSS, styleTag)
  }

  static addServerConfig (htmlStringPage: string, serverConfig: HTMLServerConfig) {
    // Stringify the JSON object, and then stringify the string object so we can inject it into the HTML
    const serverConfigString = JSON.stringify(JSON.stringify(serverConfig))
    const configScriptTag = `<script type="application/javascript">window.PeerTubeServerConfig = ${serverConfigString}</script>`

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

  private static addFaviconContentHash (htmlStringPage: string) {
    return htmlStringPage.replace('[faviconContentHash]', FILES_CONTENT_HASH.FAVICON)
  }

  private static addLogoContentHash (htmlStringPage: string) {
    return htmlStringPage.replace('[logoContentHash]', FILES_CONTENT_HASH.LOGO)
  }
}
