import { Injectable } from '@angular/core'
import {
  getDefaultSanitizedHrefAttributes,
  getDefaultSanitizedSchemes,
  getDefaultSanitizedTags
} from '@peertube/peertube-core-utils'
import DOMPurify, { DOMPurify as DOMPurifyI } from 'dompurify'
import { LinkifierService } from './linkifier.service'

@Injectable()
export class HtmlRendererService {
  private simpleDomPurify: DOMPurifyI
  private enhancedDomPurify: DOMPurifyI

  constructor (private linkifier: LinkifierService) {
    this.simpleDomPurify = DOMPurify()
    this.enhancedDomPurify = DOMPurify()

    this.addHrefHook(this.simpleDomPurify)
    this.addHrefHook(this.enhancedDomPurify)

    this.addCheckSchemesHook(this.simpleDomPurify, getDefaultSanitizedSchemes())
    this.addCheckSchemesHook(this.simpleDomPurify, [ ...getDefaultSanitizedSchemes(), 'mailto' ])
  }

  private addHrefHook (dompurifyInstance: DOMPurifyI) {
    dompurifyInstance.addHook('afterSanitizeAttributes', (node: HTMLElement) => {
      if ('target' in node) {
        node.setAttribute('target', '_blank')

        const rel = node.hasAttribute('rel')
          ? node.getAttribute('rel') + ' '
          : ''

        node.setAttribute('rel', rel + 'noopener noreferrer')
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

  convertToBr (text: string) {
    const html = text.replace(/\r?\n/g, '<br />')

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [ 'br' ]
    })
  }

  async toSimpleSafeHtml (text: string) {
    const html = await this.linkifier.linkify(text)

    return this.sanitize(this.simpleDomPurify, html)
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
