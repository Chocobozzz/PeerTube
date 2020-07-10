import * as express from 'express'
import { buildFileLocale, getDefaultLocale, is18nLocale, POSSIBLE_LOCALES } from '../../shared/models/i18n/i18n'
import { CUSTOM_HTML_TAG_COMMENTS, EMBED_SIZE, PLUGIN_GLOBAL_CSS_PATH, WEBSERVER, FILES_CONTENT_HASH } from '../initializers/constants'
import { join } from 'path'
import { escapeHTML, sha256 } from '../helpers/core-utils'
import { VideoModel } from '../models/video/video'
import validator from 'validator'
import { VideoPrivacy } from '../../shared/models/videos'
import { readFile } from 'fs-extra'
import { getActivityStreamDuration } from '../models/video/video-format-utils'
import { AccountModel } from '../models/account/account'
import { VideoChannelModel } from '../models/video/video-channel'
import * as Bluebird from 'bluebird'
import { CONFIG } from '../initializers/config'
import { logger } from '../helpers/logger'
import { MAccountActor, MChannelActor, MVideo } from '../types/models'

export class ClientHtml {

  private static htmlCache: { [path: string]: string } = {}

  static invalidCache () {
    logger.info('Cleaning HTML cache.')

    ClientHtml.htmlCache = {}
  }

  static async getDefaultHTMLPage (req: express.Request, res: express.Response, paramLang?: string) {
    const html = paramLang
      ? await ClientHtml.getIndexHTML(req, res, paramLang)
      : await ClientHtml.getIndexHTML(req, res)

    let customHtml = ClientHtml.addTitleTag(html)
    customHtml = ClientHtml.addDescriptionTag(customHtml)

    return customHtml
  }

  static async getWatchHTMLPage (videoId: string, req: express.Request, res: express.Response) {
    // Let Angular application handle errors
    if (!validator.isInt(videoId) && !validator.isUUID(videoId, 4)) {
      res.status(404)
      return ClientHtml.getIndexHTML(req, res)
    }

    const [ html, video ] = await Promise.all([
      ClientHtml.getIndexHTML(req, res),
      VideoModel.loadWithBlacklist(videoId)
    ])

    // Let Angular application handle errors
    if (!video || video.privacy === VideoPrivacy.PRIVATE || video.privacy === VideoPrivacy.INTERNAL || video.VideoBlacklist) {
      res.status(404)
      return html
    }

    let customHtml = ClientHtml.addTitleTag(html, escapeHTML(video.name))
    customHtml = ClientHtml.addDescriptionTag(customHtml, escapeHTML(video.description))
    customHtml = ClientHtml.addVideoOpenGraphAndOEmbedTags(customHtml, video)

    return customHtml
  }

  static async getAccountHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    return this.getAccountOrChannelHTMLPage(() => AccountModel.loadByNameWithHost(nameWithHost), req, res)
  }

  static async getVideoChannelHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    return this.getAccountOrChannelHTMLPage(() => VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithHost), req, res)
  }

  private static async getAccountOrChannelHTMLPage (
    loader: () => Bluebird<MAccountActor | MChannelActor>,
    req: express.Request,
    res: express.Response
  ) {
    const [ html, entity ] = await Promise.all([
      ClientHtml.getIndexHTML(req, res),
      loader()
    ])

    // Let Angular application handle errors
    if (!entity) {
      res.status(404)
      return ClientHtml.getIndexHTML(req, res)
    }

    let customHtml = ClientHtml.addTitleTag(html, escapeHTML(entity.getDisplayName()))
    customHtml = ClientHtml.addDescriptionTag(customHtml, escapeHTML(entity.description))
    customHtml = ClientHtml.addAccountOrChannelMetaTags(customHtml, entity)

    return customHtml
  }

  private static async getIndexHTML (req: express.Request, res: express.Response, paramLang?: string) {
    const path = ClientHtml.getIndexPath(req, res, paramLang)
    if (ClientHtml.htmlCache[path]) return ClientHtml.htmlCache[path]

    const buffer = await readFile(path)

    let html = buffer.toString()

    if (paramLang) html = ClientHtml.addHtmlLang(html, paramLang)
    html = ClientHtml.addManifestContentHash(html)
    html = ClientHtml.addFaviconContentHash(html)
    html = ClientHtml.addLogoContentHash(html)
    html = ClientHtml.addCustomCSS(html)
    html = await ClientHtml.addAsyncPluginCSS(html)

    ClientHtml.htmlCache[path] = html

    return html
  }

  private static getIndexPath (req: express.Request, res: express.Response, paramLang: string) {
    let lang: string

    // Check param lang validity
    if (paramLang && is18nLocale(paramLang)) {
      lang = paramLang

      // Save locale in cookies
      res.cookie('clientLanguage', lang, {
        secure: WEBSERVER.SCHEME === 'https',
        sameSite: 'none',
        maxAge: 1000 * 3600 * 24 * 90 // 3 months
      })

    } else if (req.cookies.clientLanguage && is18nLocale(req.cookies.clientLanguage)) {
      lang = req.cookies.clientLanguage
    } else {
      lang = req.acceptsLanguages(POSSIBLE_LOCALES) || getDefaultLocale()
    }

    return join(__dirname, '../../../client/dist/' + buildFileLocale(lang) + '/index.html')
  }

  private static addHtmlLang (htmlStringPage: string, paramLang: string) {
    return htmlStringPage.replace('<html>', `<html lang="${paramLang}">`)
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

  private static addTitleTag (htmlStringPage: string, title?: string) {
    let text = title || CONFIG.INSTANCE.NAME
    if (title) text += ` - ${CONFIG.INSTANCE.NAME}`

    const titleTag = `<title>${text}</title>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.TITLE, titleTag)
  }

  private static addDescriptionTag (htmlStringPage: string, description?: string) {
    const content = description || CONFIG.INSTANCE.SHORT_DESCRIPTION
    const descriptionTag = `<meta name="description" content="${content}" />`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.DESCRIPTION, descriptionTag)
  }

  private static addCustomCSS (htmlStringPage: string) {
    const styleTag = `<style class="custom-css-style">${CONFIG.INSTANCE.CUSTOMIZATIONS.CSS}</style>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.CUSTOM_CSS, styleTag)
  }

  private static async addAsyncPluginCSS (htmlStringPage: string) {
    const globalCSSContent = await readFile(PLUGIN_GLOBAL_CSS_PATH)
    if (globalCSSContent.byteLength === 0) return htmlStringPage

    const fileHash = sha256(globalCSSContent)
    const linkTag = `<link rel="stylesheet" href="/plugins/global.css?hash=${fileHash}" />`

    return htmlStringPage.replace('</head>', linkTag + '</head>')
  }

  private static addVideoOpenGraphAndOEmbedTags (htmlStringPage: string, video: MVideo) {
    const previewUrl = WEBSERVER.URL + video.getPreviewStaticPath()
    const videoUrl = WEBSERVER.URL + video.getWatchStaticPath()

    const videoNameEscaped = escapeHTML(video.name)
    const videoDescriptionEscaped = escapeHTML(video.description)
    const embedUrl = WEBSERVER.URL + video.getEmbedStaticPath()

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
        href: WEBSERVER.URL + '/services/oembed?url=' + encodeURIComponent(videoUrl),
        title: videoNameEscaped
      }
    ]

    const schemaTags = {
      '@context': 'http://schema.org',
      '@type': 'VideoObject',
      'name': videoNameEscaped,
      'description': videoDescriptionEscaped,
      'thumbnailUrl': previewUrl,
      'uploadDate': video.createdAt.toISOString(),
      'duration': getActivityStreamDuration(video.duration),
      'contentUrl': videoUrl,
      'embedUrl': embedUrl,
      'interactionCount': video.views
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

    // SEO, use origin video url so Google does not index remote videos
    tagsString += `<link rel="canonical" href="${video.url}" />`

    return this.addOpenGraphAndOEmbedTags(htmlStringPage, tagsString)
  }

  private static addAccountOrChannelMetaTags (htmlStringPage: string, entity: MAccountActor | MChannelActor) {
    // SEO, use origin account or channel URL
    const metaTags = `<link rel="canonical" href="${entity.Actor.url}" />`

    return this.addOpenGraphAndOEmbedTags(htmlStringPage, metaTags)
  }

  private static addOpenGraphAndOEmbedTags (htmlStringPage: string, metaTags: string) {
    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.META_TAGS, metaTags)
  }
}
