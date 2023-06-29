import express from 'express'
import { pathExists, readFile } from 'fs-extra'
import { join } from 'path'
import validator from 'validator'
import { isTestOrDevInstance } from '@server/helpers/core-utils'
import { toCompleteUUID } from '@server/helpers/custom-validators/misc'
import { mdToOneLinePlainText } from '@server/helpers/markdown'
import { ActorImageModel } from '@server/models/actor/actor-image'
import { root } from '@shared/core-utils'
import { escapeHTML } from '@shared/core-utils/renderer'
import { sha256 } from '@shared/extra-utils'
import { HTMLServerConfig } from '@shared/models'
import { buildFileLocale, getDefaultLocale, is18nLocale, POSSIBLE_LOCALES } from '../../shared/core-utils/i18n/i18n'
import { HttpStatusCode } from '../../shared/models/http/http-error-codes'
import { VideoPlaylistPrivacy, VideoPrivacy } from '../../shared/models/videos'
import { logger } from '../helpers/logger'
import { CONFIG } from '../initializers/config'
import {
  ACCEPT_HEADERS,
  CUSTOM_HTML_TAG_COMMENTS,
  EMBED_SIZE,
  FILES_CONTENT_HASH,
  PLUGIN_GLOBAL_CSS_PATH,
  WEBSERVER
} from '../initializers/constants'
import { AccountModel } from '../models/account/account'
import { VideoModel } from '../models/video/video'
import { VideoChannelModel } from '../models/video/video-channel'
import { VideoPlaylistModel } from '../models/video/video-playlist'
import { MAccountHost, MChannelHost, MVideo, MVideoPlaylist } from '../types/models'
import { getActivityStreamDuration } from './activitypub/activity'
import { getBiggestActorImage } from './actor-image'
import { Hooks } from './plugins/hooks'
import { ServerConfigManager } from './server-config-manager'
import { isVideoInPrivateDirectory } from './video-privacy'

type Tags = {
  ogType: string
  twitterCard: 'player' | 'summary' | 'summary_large_image'
  schemaType: string

  list?: {
    numberOfItems: number
  }

  escapedSiteName: string
  escapedTitle: string
  escapedDescription: string

  url: string
  originUrl: string

  disallowIndexation?: boolean

  embed?: {
    url: string
    createdAt: string
    duration?: string
    views?: number
  }

  image: {
    url: string
    width?: number
    height?: number
  }
}

type HookContext = {
  video?: MVideo
  playlist?: MVideoPlaylist
}

class ClientHtml {

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

  static async getWatchHTMLPage (videoIdArg: string, req: express.Request, res: express.Response) {
    const videoId = toCompleteUUID(videoIdArg)

    // Let Angular application handle errors
    if (!validator.isInt(videoId) && !validator.isUUID(videoId, 4)) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return ClientHtml.getIndexHTML(req, res)
    }

    const [ html, video ] = await Promise.all([
      ClientHtml.getIndexHTML(req, res),
      VideoModel.loadWithBlacklist(videoId)
    ])

    // Let Angular application handle errors
    if (!video || isVideoInPrivateDirectory(video.privacy) || video.VideoBlacklist) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return html
    }
    const description = mdToOneLinePlainText(video.description)

    let customHtml = ClientHtml.addTitleTag(html, video.name)
    customHtml = ClientHtml.addDescriptionTag(customHtml, description)

    const url = WEBSERVER.URL + video.getWatchStaticPath()
    const originUrl = video.url
    const title = video.name
    const siteName = CONFIG.INSTANCE.NAME

    const image = {
      url: WEBSERVER.URL + video.getPreviewStaticPath()
    }

    const embed = {
      url: WEBSERVER.URL + video.getEmbedStaticPath(),
      createdAt: video.createdAt.toISOString(),
      duration: getActivityStreamDuration(video.duration),
      views: video.views
    }

    const ogType = 'video'
    const twitterCard = CONFIG.SERVICES.TWITTER.WHITELISTED ? 'player' : 'summary_large_image'
    const schemaType = 'VideoObject'

    customHtml = await ClientHtml.addTags(customHtml, {
      url,
      originUrl,
      escapedSiteName: escapeHTML(siteName),
      escapedTitle: escapeHTML(title),
      escapedDescription: escapeHTML(description),
      disallowIndexation: video.privacy !== VideoPrivacy.PUBLIC,
      image,
      embed,
      ogType,
      twitterCard,
      schemaType
    }, { video })

    return customHtml
  }

  static async getWatchPlaylistHTMLPage (videoPlaylistIdArg: string, req: express.Request, res: express.Response) {
    const videoPlaylistId = toCompleteUUID(videoPlaylistIdArg)

    // Let Angular application handle errors
    if (!validator.isInt(videoPlaylistId) && !validator.isUUID(videoPlaylistId, 4)) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return ClientHtml.getIndexHTML(req, res)
    }

    const [ html, videoPlaylist ] = await Promise.all([
      ClientHtml.getIndexHTML(req, res),
      VideoPlaylistModel.loadWithAccountAndChannel(videoPlaylistId, null)
    ])

    // Let Angular application handle errors
    if (!videoPlaylist || videoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return html
    }

    const description = mdToOneLinePlainText(videoPlaylist.description)

    let customHtml = ClientHtml.addTitleTag(html, videoPlaylist.name)
    customHtml = ClientHtml.addDescriptionTag(customHtml, description)

    const url = WEBSERVER.URL + videoPlaylist.getWatchStaticPath()
    const originUrl = videoPlaylist.url
    const title = videoPlaylist.name
    const siteName = CONFIG.INSTANCE.NAME

    const image = {
      url: videoPlaylist.getThumbnailUrl()
    }

    const embed = {
      url: WEBSERVER.URL + videoPlaylist.getEmbedStaticPath(),
      createdAt: videoPlaylist.createdAt.toISOString()
    }

    const list = {
      numberOfItems: videoPlaylist.get('videosLength') as number
    }

    const ogType = 'video'
    const twitterCard = CONFIG.SERVICES.TWITTER.WHITELISTED ? 'player' : 'summary'
    const schemaType = 'ItemList'

    customHtml = await ClientHtml.addTags(customHtml, {
      url,
      originUrl,
      escapedSiteName: escapeHTML(siteName),
      escapedTitle: escapeHTML(title),
      escapedDescription: escapeHTML(description),
      disallowIndexation: videoPlaylist.privacy !== VideoPlaylistPrivacy.PUBLIC,
      embed,
      image,
      list,
      ogType,
      twitterCard,
      schemaType
    }, { playlist: videoPlaylist })

    return customHtml
  }

  static async getAccountHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    const accountModelPromise = AccountModel.loadByNameWithHost(nameWithHost)
    return this.getAccountOrChannelHTMLPage(() => accountModelPromise, req, res)
  }

  static async getVideoChannelHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    const videoChannelModelPromise = VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithHost)
    return this.getAccountOrChannelHTMLPage(() => videoChannelModelPromise, req, res)
  }

  static async getActorHTMLPage (nameWithHost: string, req: express.Request, res: express.Response) {
    const [ account, channel ] = await Promise.all([
      AccountModel.loadByNameWithHost(nameWithHost),
      VideoChannelModel.loadByNameWithHostAndPopulateAccount(nameWithHost)
    ])

    return this.getAccountOrChannelHTMLPage(() => Promise.resolve(account || channel), req, res)
  }

  static async getEmbedHTML () {
    const path = ClientHtml.getEmbedPath()

    // Disable HTML cache in dev mode because webpack can regenerate JS files
    if (!isTestOrDevInstance() && ClientHtml.htmlCache[path]) {
      return ClientHtml.htmlCache[path]
    }

    const buffer = await readFile(path)
    const serverConfig = await ServerConfigManager.Instance.getHTMLServerConfig()

    let html = buffer.toString()
    html = await ClientHtml.addAsyncPluginCSS(html)
    html = ClientHtml.addCustomCSS(html)
    html = ClientHtml.addTitleTag(html)
    html = ClientHtml.addDescriptionTag(html)
    html = ClientHtml.addServerConfig(html, serverConfig)

    ClientHtml.htmlCache[path] = html

    return html
  }

  private static async getAccountOrChannelHTMLPage (
    loader: () => Promise<MAccountHost | MChannelHost>,
    req: express.Request,
    res: express.Response
  ) {
    const [ html, entity ] = await Promise.all([
      ClientHtml.getIndexHTML(req, res),
      loader()
    ])

    // Let Angular application handle errors
    if (!entity) {
      res.status(HttpStatusCode.NOT_FOUND_404)
      return ClientHtml.getIndexHTML(req, res)
    }

    const description = mdToOneLinePlainText(entity.description)

    let customHtml = ClientHtml.addTitleTag(html, entity.getDisplayName())
    customHtml = ClientHtml.addDescriptionTag(customHtml, description)

    const url = entity.getClientUrl()
    const originUrl = entity.Actor.url
    const siteName = CONFIG.INSTANCE.NAME
    const title = entity.getDisplayName()

    const avatar = getBiggestActorImage(entity.Actor.Avatars)
    const image = {
      url: ActorImageModel.getImageUrl(avatar),
      width: avatar?.width,
      height: avatar?.height
    }

    const ogType = 'website'
    const twitterCard = 'summary'
    const schemaType = 'ProfilePage'

    customHtml = await ClientHtml.addTags(customHtml, {
      url,
      originUrl,
      escapedTitle: escapeHTML(title),
      escapedSiteName: escapeHTML(siteName),
      escapedDescription: escapeHTML(description),
      image,
      ogType,
      twitterCard,
      schemaType,
      disallowIndexation: !entity.Actor.isOwned()
    }, {})

    return customHtml
  }

  private static async getIndexHTML (req: express.Request, res: express.Response, paramLang?: string) {
    const path = ClientHtml.getIndexPath(req, res, paramLang)
    if (ClientHtml.htmlCache[path]) return ClientHtml.htmlCache[path]

    const buffer = await readFile(path)
    const serverConfig = await ServerConfigManager.Instance.getHTMLServerConfig()

    let html = buffer.toString()

    html = ClientHtml.addManifestContentHash(html)
    html = ClientHtml.addFaviconContentHash(html)
    html = ClientHtml.addLogoContentHash(html)
    html = ClientHtml.addCustomCSS(html)
    html = ClientHtml.addServerConfig(html, serverConfig)
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

    logger.debug(
      'Serving %s HTML language', buildFileLocale(lang),
      { cookie: req.cookies?.clientLanguage, paramLang, acceptLanguage: req.headers['accept-language'] }
    )

    return join(root(), 'client', 'dist', buildFileLocale(lang), 'index.html')
  }

  private static getEmbedPath () {
    return join(root(), 'client', 'dist', 'standalone', 'videos', 'embed.html')
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

    const titleTag = `<title>${escapeHTML(text)}</title>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.TITLE, titleTag)
  }

  private static addDescriptionTag (htmlStringPage: string, description?: string) {
    const content = description || CONFIG.INSTANCE.SHORT_DESCRIPTION
    const descriptionTag = `<meta name="description" content="${escapeHTML(content)}" />`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.DESCRIPTION, descriptionTag)
  }

  private static addCustomCSS (htmlStringPage: string) {
    const styleTag = `<style class="custom-css-style">${CONFIG.INSTANCE.CUSTOMIZATIONS.CSS}</style>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.CUSTOM_CSS, styleTag)
  }

  private static addServerConfig (htmlStringPage: string, serverConfig: HTMLServerConfig) {
    // Stringify the JSON object, and then stringify the string object so we can inject it into the HTML
    const serverConfigString = JSON.stringify(JSON.stringify(serverConfig))
    const configScriptTag = `<script type="application/javascript">window.PeerTubeServerConfig = ${serverConfigString}</script>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.SERVER_CONFIG, configScriptTag)
  }

  private static async addAsyncPluginCSS (htmlStringPage: string) {
    if (!pathExists(PLUGIN_GLOBAL_CSS_PATH)) {
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

  private static generateOpenGraphMetaTags (tags: Tags) {
    const metaTags = {
      'og:type': tags.ogType,
      'og:site_name': tags.escapedSiteName,
      'og:title': tags.escapedTitle,
      'og:image': tags.image.url
    }

    if (tags.image.width && tags.image.height) {
      metaTags['og:image:width'] = tags.image.width
      metaTags['og:image:height'] = tags.image.height
    }

    metaTags['og:url'] = tags.url
    metaTags['og:description'] = tags.escapedDescription

    if (tags.embed) {
      metaTags['og:video:url'] = tags.embed.url
      metaTags['og:video:secure_url'] = tags.embed.url
      metaTags['og:video:type'] = 'text/html'
      metaTags['og:video:width'] = EMBED_SIZE.width
      metaTags['og:video:height'] = EMBED_SIZE.height
    }

    return metaTags
  }

  private static generateStandardMetaTags (tags: Tags) {
    return {
      name: tags.escapedTitle,
      description: tags.escapedDescription,
      image: tags.image.url
    }
  }

  private static generateTwitterCardMetaTags (tags: Tags) {
    const metaTags = {
      'twitter:card': tags.twitterCard,
      'twitter:site': CONFIG.SERVICES.TWITTER.USERNAME,
      'twitter:title': tags.escapedTitle,
      'twitter:description': tags.escapedDescription,
      'twitter:image': tags.image.url
    }

    if (tags.image.width && tags.image.height) {
      metaTags['twitter:image:width'] = tags.image.width
      metaTags['twitter:image:height'] = tags.image.height
    }

    if (tags.twitterCard === 'player') {
      metaTags['twitter:player'] = tags.embed.url
      metaTags['twitter:player:width'] = EMBED_SIZE.width
      metaTags['twitter:player:height'] = EMBED_SIZE.height
    }

    return metaTags
  }

  private static async generateSchemaTags (tags: Tags, context: HookContext) {
    const schema = {
      '@context': 'http://schema.org',
      '@type': tags.schemaType,
      'name': tags.escapedTitle,
      'description': tags.escapedDescription,
      'image': tags.image.url,
      'url': tags.url
    }

    if (tags.list) {
      schema['numberOfItems'] = tags.list.numberOfItems
      schema['thumbnailUrl'] = tags.image.url
    }

    if (tags.embed) {
      schema['embedUrl'] = tags.embed.url
      schema['uploadDate'] = tags.embed.createdAt

      if (tags.embed.duration) schema['duration'] = tags.embed.duration

      schema['thumbnailUrl'] = tags.image.url
      schema['contentUrl'] = tags.url
    }

    return Hooks.wrapObject(schema, 'filter:html.client.json-ld.result', context)
  }

  private static async addTags (htmlStringPage: string, tagsValues: Tags, context: HookContext) {
    const openGraphMetaTags = this.generateOpenGraphMetaTags(tagsValues)
    const standardMetaTags = this.generateStandardMetaTags(tagsValues)
    const twitterCardMetaTags = this.generateTwitterCardMetaTags(tagsValues)
    const schemaTags = await this.generateSchemaTags(tagsValues, context)

    const { url, escapedTitle, embed, originUrl, disallowIndexation } = tagsValues

    const oembedLinkTags: { type: string, href: string, escapedTitle: string }[] = []

    if (embed) {
      oembedLinkTags.push({
        type: 'application/json+oembed',
        href: WEBSERVER.URL + '/services/oembed?url=' + encodeURIComponent(url),
        escapedTitle
      })
    }

    let tagsStr = ''

    // Opengraph
    Object.keys(openGraphMetaTags).forEach(tagName => {
      const tagValue = openGraphMetaTags[tagName]

      tagsStr += `<meta property="${tagName}" content="${tagValue}" />`
    })

    // Standard
    Object.keys(standardMetaTags).forEach(tagName => {
      const tagValue = standardMetaTags[tagName]

      tagsStr += `<meta property="${tagName}" content="${tagValue}" />`
    })

    // Twitter card
    Object.keys(twitterCardMetaTags).forEach(tagName => {
      const tagValue = twitterCardMetaTags[tagName]

      tagsStr += `<meta property="${tagName}" content="${tagValue}" />`
    })

    // OEmbed
    for (const oembedLinkTag of oembedLinkTags) {
      tagsStr += `<link rel="alternate" type="${oembedLinkTag.type}" href="${oembedLinkTag.href}" title="${oembedLinkTag.escapedTitle}" />`
    }

    // Schema.org
    if (schemaTags) {
      tagsStr += `<script type="application/ld+json">${JSON.stringify(schemaTags)}</script>`
    }

    // SEO, use origin URL
    tagsStr += `<link rel="canonical" href="${originUrl}" />`

    if (disallowIndexation) {
      tagsStr += `<meta name="robots" content="noindex" />`
    }

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.META_TAGS, tagsStr)
  }
}

function sendHTML (html: string, res: express.Response, localizedHTML: boolean = false) {
  res.set('Content-Type', 'text/html; charset=UTF-8')

  if (localizedHTML) {
    res.set('Vary', 'Accept-Language')
  }

  return res.send(html)
}

async function serveIndexHTML (req: express.Request, res: express.Response) {
  if (req.accepts(ACCEPT_HEADERS) === 'html' || !req.headers.accept) {
    try {
      await generateHTMLPage(req, res, req.params.language)
      return
    } catch (err) {
      logger.error('Cannot generate HTML page.', { err })
      return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR_500).end()
    }
  }

  return res.status(HttpStatusCode.NOT_ACCEPTABLE_406).end()
}

// ---------------------------------------------------------------------------

export {
  ClientHtml,
  sendHTML,
  serveIndexHTML
}

async function generateHTMLPage (req: express.Request, res: express.Response, paramLang?: string) {
  const html = await ClientHtml.getDefaultHTMLPage(req, res, paramLang)

  return sendHTML(html, res, true)
}
