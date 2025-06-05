import { Injectable, inject } from '@angular/core'
import { getDefaultSanitizedHrefAttributes, getDefaultSanitizedSchemes, getDefaultSanitizedTags } from '@peertube/peertube-core-utils'
import DOMPurify, { DOMPurify as DOMPurifyI } from 'dompurify'
import { LinkifierService } from './linkifier.service'

@Injectable()
export class HtmlRendererService {
  private linkifier = inject(LinkifierService)

  private simpleDomPurify: DOMPurifyI
  private enhancedDomPurify: DOMPurifyI

  constructor () {
    this.simpleDomPurify = DOMPurify()
    this.enhancedDomPurify = DOMPurify()

    this.addHrefHook(this.simpleDomPurify)
    this.addHrefHook(this.enhancedDomPurify)

    this.addCheckSchemesHook(this.simpleDomPurify, getDefaultSanitizedSchemes())
    this.addCheckSchemesHook(this.enhancedDomPurify, [ ...getDefaultSanitizedSchemes(), 'mailto' ])
  }

  private addHrefHook (dompurifyInstance: DOMPurifyI) {
    dompurifyInstance.addHook('afterSanitizeAttributes', (node: HTMLElement) => {
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

    dompurifyInstance.addHook('afterSanitizeAttributes', (node: HTMLElement) => {
      const anchor = document.createElement('a')

      if (node.hasAttribute('href')) {
        anchor.href = node.getAttribute('href')

        if (anchor.protocol && !anchor.protocol.match(regex)) {
          node.removeAttribute('href')
        }
      }
    })
  }

  convertToBr (text: string, allowFormatting = false) {
    const html = text.replace(/\r?\n/g, '<br />')

    const additionalAllowed = allowFormatting
      ? [ 'b', 'i', 'u', 'strong', 'em' ]
      : []

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [ ...additionalAllowed, 'br' ]
    })
  }

  removeClassAttributes (html: string, options: {
    additionalTags?: string[]
    additionalAttributes?: string[]
  } = {}) {
    const { additionalTags = [], additionalAttributes = [] } = options

    return DOMPurify().sanitize(html, {
      ALLOWED_TAGS: [ ...getDefaultSanitizedTags(), ...additionalTags ],
      ALLOWED_ATTR: [ ...getDefaultSanitizedHrefAttributes(), ...additionalAttributes ].filter(a => a !== 'class'),
      ALLOW_DATA_ATTR: true
    })
  }

  toSimpleSafeHtml (text: string) {
    return this.sanitize(this.simpleDomPurify, this.removeClassAttributes(text))
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
      additionalAttributes: [ 'src', 'alt', 'style' ]
    })
  }

  private sanitize (domPurify: DOMPurifyI, html: string, options: {
    additionalTags?: string[]
    additionalAttributes?: string[]
  } = {}) {
    const { additionalTags = [], additionalAttributes = [] } = options

    return domPurify.sanitize(html, {
      ALLOWED_TAGS: [ ...getDefaultSanitizedTags(), ...additionalTags ],
      ALLOWED_ATTR: [ ...getDefaultSanitizedHrefAttributes(), ...additionalAttributes ],
      ALLOW_DATA_ATTR: true
    })
  }
}
