import { escapeAttribute, escapeHTML } from '@peertube/peertube-core-utils'
import { mdToPlainText } from '@server/helpers/markdown.js'
import truncate from 'lodash-es/truncate.js'
import { parse } from 'node-html-parser'
import { CONFIG } from '../../../initializers/config.js'
import { CUSTOM_HTML_TAG_COMMENTS, EMBED_SIZE, WEBSERVER } from '../../../initializers/constants.js'
import { MVideo, MVideoPlaylist } from '../../../types/models/index.js'
import { Hooks } from '../../plugins/hooks.js'

export type TagsOptions = {
  forbidIndexation: boolean

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

  relMe?: string

  image?: {
    url: string
    width: number
    height: number
  }

  embed?: {
    url: string
    createdAt: string
    duration?: string
    views?: number
  }

  oembedUrl?: string

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

    return html.querySelector('a[rel=me]')?.getAttribute('href') || undefined
  }

  // ---------------------------------------------------------------------------

  static async addTags (htmlStringPage: string, tagsValues: TagsOptions, context: HookContext) {
    const metaTags = {
      ...this.generateOpenGraphMetaTagsOptions(tagsValues),
      ...this.generateStandardMetaTagsOptions(tagsValues),
      ...this.generateTwitterCardMetaTagsOptions(tagsValues)
    }
    const schemaTags = await this.generateSchemaTagsOptions(tagsValues, context)

    const { url, escapedTitle, oembedUrl, forbidIndexation, relMe, rssFeeds } = tagsValues

    const oembedLinkTags: { type: string, href: string, escapedTitle: string }[] = []

    if (oembedUrl) {
      oembedLinkTags.push({
        type: 'application/json+oembed',
        href: WEBSERVER.URL + '/services/oembed?url=' + encodeURIComponent(oembedUrl),
        escapedTitle
      })
    }

    let tagsStr = ''

    for (const tagName of Object.keys(metaTags)) {
      const tagValue = metaTags[tagName]
      if (!tagValue) continue

      tagsStr += `<meta property="${tagName}" content="${escapeAttribute(tagValue)}" />`
    }

    // OEmbed
    for (const oembedLinkTag of oembedLinkTags) {
      // eslint-disable-next-line max-len
      tagsStr += `<link rel="alternate" type="${oembedLinkTag.type}" href="${oembedLinkTag.href}" title="${escapeAttribute(oembedLinkTag.escapedTitle)}" />`
    }

    // Schema.org
    if (schemaTags) {
      tagsStr += `<script type="application/ld+json">${JSON.stringify(schemaTags)}</script>`
    }

    if (relMe) {
      tagsStr += `<link href="${escapeAttribute(relMe)}" rel="me">`
    }

    // SEO, use origin URL
    if (forbidIndexation !== true && url) {
      tagsStr += `<link rel="canonical" href="${url}" />`
    }

    if (forbidIndexation === true) {
      tagsStr += `<meta name="robots" content="noindex" />`
    }

    for (const rssLink of (rssFeeds || [])) {
      tagsStr += `<link rel="alternate" type="application/rss+xml" title="${escapeAttribute(rssLink.title)}" href="${rssLink.url}" />`
    }

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
      metaTags['og:image:url'] = tags.image.url
    }

    if (tags.image?.width && tags.image?.height) {
      metaTags['og:image:width'] = tags.image.width
      metaTags['og:image:height'] = tags.image.height
    }

    metaTags['og:url'] = tags.url
    metaTags['og:description'] = tags.escapedTruncatedDescription

    if (tags.embed) {
      metaTags['og:video:url'] = tags.embed.url
      metaTags['og:video:secure_url'] = tags.embed.url
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

    if (tags.twitterCard === 'player') {
      metaTags['twitter:player'] = tags.embed.url
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

    const schema = {
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

    if (tags.embed) {
      schema['embedUrl'] = tags.embed.url
      schema['uploadDate'] = tags.embed.createdAt

      if (tags.embed.duration) schema['duration'] = tags.embed.duration

      schema['thumbnailUrl'] = tags.image?.url
    }

    return Hooks.wrapObject(schema, 'filter:html.client.json-ld.result', context)
  }

  // ---------------------------------------------------------------------------

  static buildEscapedTruncatedDescription (description: string) {
    return truncate(mdToPlainText(description), { length: 200 })
  }
}
