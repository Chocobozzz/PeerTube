import { escapeAttribute, escapeHTML } from '@peertube/peertube-core-utils'
import { mdToPlainText } from '@server/helpers/markdown.js'
import { getActivityStreamDuration } from '@server/lib/activitypub/activity.js'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { getServerActor } from '@server/models/application/application.js'
import truncate from 'lodash-es/truncate.js'
import { parse } from 'node-html-parser'
import { CONFIG } from '../../../initializers/config.js'
import { CUSTOM_HTML_TAG_COMMENTS, EMBED_SIZE, WEBSERVER } from '../../../initializers/constants.js'
import { MVideo, MVideoPlaylist } from '../../../types/models/index.js'
import { Hooks } from '../../plugins/hooks.js'

type JsonldSchema = {
  '@context': 'http://schema.org'
  '@type': string

  name: string
  description: string
  image: string
  url: string

  embedUrl?: string
  uploadDate?: string

  thumbnailUrl?: string
  numberOfItems?: number
  duration?: string
  inLanguage?: string

  interactionStatistic?: {
    '@type': 'InteractionCounter'
    interactionType: string
    userInteractionCount: number
  }[]

  keywords?: string[]

  author?: {
    '@type': 'Organization'
    name: string
    url: string
  }

  contentRating?: 'Mature' | 'General Audience'

  datePublished?: string
  dateModified?: string

  caption?: {
    '@type': 'MediaObject'
    'contentUrl': string
    'encodingFormat': string
    'inLanguage': string
    'name': string
  }[]
}

export type TagsOptions = {
  forbidIndexation: boolean
  embedIndexation: boolean

  url?: string

  ogType?: string
  twitterCard?: 'player' | 'summary' | 'summary_large_image'

  schemaType?: string

  jsonldProfile?: {
    createdAt: Date
    updatedAt: Date
  }

  list?: {
    numberOfItems: number
  }

  escapedSiteName?: string
  escapedTitle?: string
  escapedTruncatedDescription?: string

  relMe?: string[]

  image?: {
    url: string
    width: number
    height: number
  }

  videoOrPlaylist?: {
    embedUrl: string
    oembedUrl: string
    updatedAt: string
    createdAt: string

    channel?: {
      displayName: string
      url: string
    }
  }

  video?: {
    duration: number
    language: string
    tags: string[]

    views: number
    likes: number
    dislikes: number

    nsfw: boolean
    publishedAt: string

    captions: {
      label: string
      mediaType: string
      language: string
      url: string
    }[]
  }

  rssFeeds?: {
    title: string
    url: string
  }[]
}

type HookContext = {
  video?: MVideo
  playlist?: MVideoPlaylist
}

export class TagsHtml {
  static addTitleTag (htmlStringPage: string, title?: string) {
    let text = title || CONFIG.INSTANCE.NAME
    if (title) text += ` - ${CONFIG.INSTANCE.NAME}`

    const titleTag = `<title>${escapeHTML(text)}</title>`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.TITLE, titleTag)
  }

  static addDescriptionTag (htmlStringPage: string, escapedTruncatedDescription?: string) {
    const content = escapedTruncatedDescription || escapeHTML(CONFIG.INSTANCE.SHORT_DESCRIPTION)
    const descriptionTag = `<meta name="description" content="${escapeAttribute(content)}" />`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.DESCRIPTION, descriptionTag)
  }

  static findRelMe (content: string) {
    if (!content) return undefined

    const html = parse(content)

    return html.querySelectorAll('a[rel=me]').map(e => e.getAttribute('href'))
  }

  // ---------------------------------------------------------------------------

  static async addTags (htmlStringPage: string, tagsValues: TagsOptions, context: HookContext) {
    const { url, escapedTitle, videoOrPlaylist, forbidIndexation, embedIndexation, relMe, rssFeeds } = tagsValues
    const serverActor = await getServerActor()

    let tagsStr = ''

    // Global meta tags
    const metaTags = {
      ...this.generateOpenGraphMetaTagsOptions(tagsValues),
      ...this.generateStandardMetaTagsOptions(tagsValues),
      ...this.generateTwitterCardMetaTagsOptions(tagsValues)
    }

    for (const tagName of Object.keys(metaTags)) {
      const tagValue = metaTags[tagName]
      if (!tagValue) continue

      tagsStr += `<meta property="${tagName}" content="${escapeAttribute(tagValue)}" />`
    }

    // OEmbed
    if (videoOrPlaylist?.oembedUrl) {
      const href = WEBSERVER.URL + '/services/oembed?url=' + encodeURIComponent(videoOrPlaylist.oembedUrl)

      tagsStr += `<link rel="alternate" type="application/json+oembed" href="${href}" title="${escapeAttribute(escapedTitle)}" />`
    }

    // Schema.org
    const schemaTags = await this.generateSchemaTagsOptions(tagsValues, context)

    if (schemaTags) {
      tagsStr += `<script type="application/ld+json">${JSON.stringify(schemaTags)}</script>`
    }

    // Rel Me
    if (Array.isArray(relMe)) {
      for (const relMeLink of relMe) {
        tagsStr += `<link href="${escapeAttribute(relMeLink)}" rel="me">`
      }
    }

    // SEO
    if (forbidIndexation === true) {
      tagsStr += `<meta name="robots" content="noindex" />`
    } else if (embedIndexation) {
      tagsStr += `<meta name="robots" content="noindex, indexifembedded" />`
    } else if (url) { // SEO, use origin URL
      tagsStr += `<link rel="canonical" href="${url}" />`
    }

    // RSS
    for (const rssLink of (rssFeeds || [])) {
      tagsStr += `<link rel="alternate" type="application/rss+xml" title="${escapeAttribute(rssLink.title)}" href="${rssLink.url}" />`
    }

    // Favicon
    const favicon = ServerConfigManager.Instance.getFavicon(serverActor)
    tagsStr += `<link rel="icon" type="image/png" href="${escapeAttribute(favicon.fileUrl)}" />`

    // Apple Touch Icon
    const iconHref = ServerConfigManager.Instance.getLogoUrl(serverActor, 192)

    tagsStr += `<link rel="apple-touch-icon" href="${iconHref}" />`

    return htmlStringPage.replace(CUSTOM_HTML_TAG_COMMENTS.META_TAGS, tagsStr)
  }

  // ---------------------------------------------------------------------------

  static generateOpenGraphMetaTagsOptions (tags: TagsOptions) {
    if (!tags.ogType) return {}

    const metaTags = {
      'og:type': tags.ogType,
      'og:site_name': tags.escapedSiteName,
      'og:title': tags.escapedTitle
    }

    if (tags.image?.url) {
      metaTags['og:image'] = tags.image.url
    }

    if (tags.image?.width && tags.image?.height) {
      metaTags['og:image:width'] = tags.image.width
      metaTags['og:image:height'] = tags.image.height
    }

    metaTags['og:url'] = tags.url
    metaTags['og:description'] = tags.escapedTruncatedDescription

    if (tags.videoOrPlaylist) {
      metaTags['og:video:url'] = tags.videoOrPlaylist.embedUrl
      metaTags['og:video:secure_url'] = tags.videoOrPlaylist.embedUrl
      metaTags['og:video:type'] = 'text/html'
      metaTags['og:video:width'] = EMBED_SIZE.width
      metaTags['og:video:height'] = EMBED_SIZE.height
    }

    return metaTags
  }

  static generateStandardMetaTagsOptions (tags: TagsOptions) {
    return {
      name: tags.escapedTitle,
      description: tags.escapedTruncatedDescription,
      image: tags.image?.url
    }
  }

  static generateTwitterCardMetaTagsOptions (tags: TagsOptions) {
    if (!tags.twitterCard) return {}

    const metaTags = {
      'twitter:card': tags.twitterCard,
      'twitter:site': CONFIG.SERVICES.TWITTER.USERNAME,
      'twitter:title': tags.escapedTitle,
      'twitter:description': tags.escapedTruncatedDescription
    }

    if (tags.image?.url) {
      metaTags['twitter:image:url'] = tags.image.url
    }

    if (tags.image?.width && tags.image?.height) {
      metaTags['twitter:image:width'] = tags.image.width
      metaTags['twitter:image:height'] = tags.image.height
    }

    if (tags.twitterCard === 'player' && tags.videoOrPlaylist) {
      metaTags['twitter:player'] = tags.videoOrPlaylist.embedUrl
      metaTags['twitter:player:width'] = EMBED_SIZE.width
      metaTags['twitter:player:height'] = EMBED_SIZE.height
    }

    return metaTags
  }

  static generateSchemaTagsOptions (tags: TagsOptions, context: HookContext) {
    if (!tags.schemaType) return

    if (tags.schemaType === 'ProfilePage') {
      if (!tags.jsonldProfile) throw new Error('Missing `jsonldProfile` with ProfilePage schema type')

      const profilePageSchema = {
        '@context': 'http://schema.org',
        '@type': tags.schemaType,

        'dateCreated': tags.jsonldProfile.createdAt.toISOString(),
        'dateModified': tags.jsonldProfile.updatedAt.toISOString(),

        'mainEntity': {
          '@id': '#main-author',
          '@type': 'Person',
          'name': tags.escapedTitle,
          'description': tags.escapedTruncatedDescription,
          'image': tags.image?.url
        }
      }

      return Hooks.wrapObject(profilePageSchema, 'filter:html.client.json-ld.result', context)
    }

    const schema: JsonldSchema = {
      '@context': 'http://schema.org',
      '@type': tags.schemaType,
      'name': tags.escapedTitle,
      'description': tags.escapedTruncatedDescription,
      'image': tags.image?.url,
      'url': tags.url
    }

    if (tags.list) {
      schema['numberOfItems'] = tags.list.numberOfItems
      schema['thumbnailUrl'] = tags.image?.url
    }

    if (tags.videoOrPlaylist) {
      const videoOrPlaylist = tags.videoOrPlaylist
      const video = tags.video

      schema['publisher'] = {
        '@type': 'Organization',
        'name': CONFIG.INSTANCE.NAME,
        'url': WEBSERVER.URL
      }

      schema['embedUrl'] = videoOrPlaylist.embedUrl
      schema['uploadDate'] = videoOrPlaylist.createdAt

      schema['thumbnailUrl'] = tags.image?.url

      schema['dateModified'] = videoOrPlaylist.updatedAt

      if (videoOrPlaylist.channel) {
        schema['author'] = {
          '@type': 'Organization',
          'name': videoOrPlaylist.channel.displayName,
          'url': videoOrPlaylist.channel.url
        }
      }

      if (video) {
        schema['datePublished'] = video.publishedAt

        schema['interactionStatistic'] = [
          {
            '@type': 'InteractionCounter',
            'interactionType': 'http://schema.org/WatchAction',
            'userInteractionCount': video.views
          },
          {
            '@type': 'InteractionCounter',
            'interactionType': 'http://schema.org/LikeAction',
            'userInteractionCount': video.likes
          },
          {
            '@type': 'InteractionCounter',
            'interactionType': 'http://schema.org/DislikeAction',
            'userInteractionCount': video.dislikes
          }
        ]

        if (video.duration) schema['duration'] = getActivityStreamDuration(video.duration)
        if (video.language) schema['inLanguage'] = video.language

        if (video.tags.length !== 0) schema['keywords'] = video.tags

        if (video.captions.length !== 0) {
          schema['caption'] = video.captions.map(c => ({
            '@type': 'MediaObject',
            'contentUrl': c.url,
            'encodingFormat': c.mediaType,
            'inLanguage': c.language,
            'name': c.label
          }))
        }

        if (video.nsfw) schema['contentRating'] = 'Mature'
        else schema['contentRating'] = 'General Audience'
      }
    }

    return Hooks.wrapObject(schema, 'filter:html.client.json-ld.result', context)
  }

  // ---------------------------------------------------------------------------

  static buildEscapedTruncatedDescription (description: string) {
    return truncate(mdToPlainText(description), { length: 200 })
  }
}
