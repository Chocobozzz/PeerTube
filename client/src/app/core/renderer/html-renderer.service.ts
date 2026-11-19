import { Injectable, inject } from '@angular/core'
import { getDefaultSanitizedHrefAttributes, getDefaultSanitizedSchemes, getDefaultSanitizedTags } from '@peertube/peertube-core-utils'
import DOMPurify, { DOMPurify as DOMPurifyI } from 'dompurify'
import { LinkifierService } from './linkifier.service'

@Injectable()
export class HtmlRendererService {
  private linkifier = inject(LinkifierService)

  private simpleDomPurify: DOMPurifyI
  private enhancedDomPurify: DOMPurifyI
  private classDomPurify: DOMPurifyI

  constructor () {
    this.simpleDomPurify = DOMPurify()
    this.enhancedDomPurify = DOMPurify()

    // No hooks: only used to strip class attributes before content reaches the hook-enabled instances above
    this.classDomPurify = DOMPurify()

    this.addHrefHook(this.simpleDomPurify)
    this.addHrefHook(this.enhancedDomPurify)

    this.addCheckSchemesHook(this.simpleDomPurify, getDefaultSanitizedSchemes())
    this.addCheckSchemesHook(this.enhancedDomPurify, [ ...getDefaultSanitizedSchemes(), 'mailto' ])
  }

  private addHrefHook (dompurifyInstance: DOMPurifyI) {
    dompurifyInstance.addHook('afterSanitizeAttributes', (node: Element) => {
      if ('target' in node) {
        node.setAttribute('target', '_blank')

        const rel = node.hasAttribute('rel')
          ? node.getAttribute('rel')
          : ''

        const relValues = new Set(rel.split(' '))
        relValues.add('noopener')
        relValues.add('noreferrer')
        relValues.add('ugc')

        node.setAttribute('rel', [ ...relValues ].join(' '))
      }
    })
  }

  private addCheckSchemesHook (dompurifyInstance: DOMPurifyI, schemes: string[]) {
    const regex = new RegExp(`^(${schemes.join('|')}):`, 'im')
    // Reused across every node/call: cheaper than allocating a new anchor for each one, and only ever read synchronously
    const anchor = document.createElement('a')

    dompurifyInstance.addHook('afterSanitizeAttributes', (node: Element) => {
      if (!node.hasAttribute('href')) return

      anchor.href = node.getAttribute('href')

      if (anchor.protocol && !anchor.protocol.match(regex)) {
        node.removeAttribute('href')
      }
    })
  }

  convertToBr (text: string, allowFormatting = false) {
    const html = text.replace(/\r?\n/g, '<br />')

    const additionalAllowed = allowFormatting
      ? [ 'b', 'i', 'u', 'strong', 'em' ]
      : []

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [ ...additionalAllowed, 'br' ],
      // No attribute: the text may come from a remote user (captions...)
      ALLOWED_ATTR: []
    })
  }

  removeClassAttributes (html: string, options: {
    additionalTags?: string[]
    additionalAttributes?: string[]
  } = {}) {
    const { additionalTags = [], additionalAttributes = [] } = options

    return this.classDomPurify.sanitize(html, {
      ALLOWED_TAGS: [ ...getDefaultSanitizedTags(), ...additionalTags ],
      ALLOWED_ATTR: [ ...getDefaultSanitizedHrefAttributes(), ...additionalAttributes ].filter(a => a !== 'class'),
      ALLOW_DATA_ATTR: false
    })
  }

  toSimpleSafeHtml (text: string) {
    return this.sanitize(this.simpleDomPurify, text, { excludeAttributes: [ 'class' ] })
  }

  async toSimpleSafeHtmlWithLinks (text: string, options: {
    allowImages?: boolean
  } = {}) {
    const { allowImages = false } = options

    const additionalTags = allowImages
      ? [ 'img' ]
      : []

    const additionalAttributes = allowImages
      ? [ 'src', 'alt' ]
      : []

    let html = this.removeClassAttributes(text, { additionalTags, additionalAttributes })
    html = await this.linkifier.linkify(html)

    return this.sanitize(this.simpleDomPurify, html, {
      additionalTags,
      additionalAttributes
    })
  }

  async toCustomPageSafeHtml (text: string, additionalAllowedTags: string[] = []) {
    const html = await this.linkifier.linkify(text)

    const enhancedTags = [ 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img' ]

    return this.sanitize(this.enhancedDomPurify, html, {
      additionalTags: [ ...enhancedTags, ...additionalAllowedTags ],
      additionalAttributes: [ 'src', 'alt', 'style' ],
      allowDataAttributes: true
    })
  }

  private sanitize (domPurify: DOMPurifyI, html: string, options: {
    additionalTags?: string[]
    additionalAttributes?: string[]
    excludeAttributes?: string[]
    allowDataAttributes?: boolean // default false, only for admin content
  } = {}) {
    const { additionalTags = [], additionalAttributes = [], excludeAttributes = [], allowDataAttributes = false } = options

    return domPurify.sanitize(html, {
      ALLOWED_TAGS: [ ...getDefaultSanitizedTags(), ...additionalTags ],
      ALLOWED_ATTR: [ ...getDefaultSanitizedHrefAttributes(), ...additionalAttributes ].filter(a => !excludeAttributes.includes(a)),
      ALLOW_DATA_ATTR: allowDataAttributes
    })
  }
}
