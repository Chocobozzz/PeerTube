import * as express from 'express'
import * as Bluebird from 'bluebird'
import { buildFileLocale, getDefaultLocale, is18nLocale, POSSIBLE_LOCALES } from '../../shared/models/i18n/i18n'
import { CONFIG, EMBED_SIZE, CUSTOM_HTML_TAG_COMMENTS, STATIC_PATHS } from '../initializers'
import { join } from 'path'
import { escapeHTML, readFileBufferPromise } from '../helpers/core-utils'
import { VideoModel } from '../models/video/video'
import * as validator from 'validator'
import { VideoPrivacy } from '../../shared/models/videos'

export class ClientHtml {

  private static htmlCache: { [path: string]: string } = {}

  static invalidCache () {
    ClientHtml.htmlCache = {}
  }

  static async getIndexHTML (req: express.Request, res: express.Response, paramLang?: string) {
    const path = ClientHtml.getIndexPath(req, res, paramLang)
    if (ClientHtml.htmlCache[path]) return ClientHtml.htmlCache[path]

    const buffer = await readFileBufferPromise(path)

    let html = buffer.toString()

    html = ClientHtml.addTitleTag(html)
    html = ClientHtml.addDescriptionTag(html)
    html = ClientHtml.addCustomCSS(html)

    ClientHtml.htmlCache[path] = html

    return html
  }

  static async getWatchHTMLPage (videoId: string, req: express.Request, res: express.Response) {
    let videoPromise: Bluebird<VideoModel>

    // Let Angular application handle errors
    if (validator.isUUID(videoId, 4)) {
      videoPromise = VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(videoId)
    } else if (validator.isInt(videoId)) {
      videoPromise = VideoModel.loadAndPopulateAccountAndServerAndTags(+videoId)
    } else {
      return ClientHtml.getIndexHTML(req, res)
    }

    const [ html, video ] = await Promise.all([
      ClientHtml.getIndexHTML(req, res),
      videoPromise
    ])

    // Let Angular application handle errors
    if (!video || video.privacy === VideoPrivacy.PRIVATE) {
      return ClientHtml.getIndexHTML(req, res)
    }

    return ClientHtml.addOpenGraphAndOEmbedTags(html, video)
  }

  private static getIndexPath (req: express.Request, res: express.Response, paramLang?: string) {
    let lang: string

    // Check param lang validity
    if (paramLang && is18nLocale(paramLang)) {
      lang = paramLang

      // Save locale in cookies
      res.cookie('clientLanguage', lang, {
        secure: CONFIG.WEBSERVER.SCHEME === 'https',
        sameSite: true,
        maxAge: 1000 * 3600 * 24 * 90 // 3 months
      })

    } else if (req.cookies.clientLanguage && is18nLocale(req.cookies.clientLanguage)) {
      lang = req.cookies.clientLanguage
    } else {
      lang = req.acceptsLanguages(POSSIBLE_LOCALES) || getDefaultLocale()
    }

    return join(__dirname, '../../../client/dist/' + buildFileLocale(lang) + '/index.html')
  }

  private static addTitleTag (htmlStringPage: string) {
    const titleTag = '<title>' + CONFIG.INSTANCE.NAME + '</title>'

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.TITLE, titleTag)
  }

  private static addDescriptionTag (htmlStringPage: string) {
    const descriptionTag = `<meta name="description" content="${CONFIG.INSTANCE.SHORT_DESCRIPTION}" />`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.DESCRIPTION, descriptionTag)
  }

  private static addCustomCSS (htmlStringPage: string) {
    const styleTag = '<style class="custom-css-style">' + CONFIG.INSTANCE.CUSTOMIZATIONS.CSS + '</style>'

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.CUSTOM_CSS, styleTag)
  }

  private static addOpenGraphAndOEmbedTags (htmlStringPage: string, video: VideoModel) {
    const previewUrl = CONFIG.WEBSERVER.URL + STATIC_PATHS.PREVIEWS + video.getPreviewName()
    const videoUrl = CONFIG.WEBSERVER.URL + '/videos/watch/' + video.uuid

    const videoNameEscaped = escapeHTML(video.name)
    const videoDescriptionEscaped = escapeHTML(video.description)
    const embedUrl = CONFIG.WEBSERVER.URL + video.getEmbedStaticPath()

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

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.OPENGRAPH_AND_OEMBED, tagsString)
  }
}
