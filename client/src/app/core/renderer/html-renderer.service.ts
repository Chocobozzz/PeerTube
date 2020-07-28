import { Injectable } from '@angular/core'
import { LinkifierService } from './linkifier.service'

@Injectable()
export class HtmlRendererService {
  private sanitizeHtml: typeof import ('sanitize-html')

  constructor (private linkifier: LinkifierService) {

  }

  async convertToBr (text: string) {
    await this.loadSanitizeHtml()

    const html = text.replace(/\r?\n/g, '<br />')

    return this.sanitizeHtml(html, {
      allowedTags: [ 'br' ]
    })
  }

  async toSafeHtml (text: string) {
    await this.loadSanitizeHtml()

    // Convert possible markdown to html
    const html = this.linkifier.linkify(text)

    return this.sanitizeHtml(html, {
      allowedTags: [ 'a', 'p', 'span', 'br', 'strong', 'em', 'ul', 'ol', 'li' ],
      allowedSchemes: [ 'http', 'https' ],
      allowedAttributes: {
        'a': [ 'href', 'class', 'target', 'rel' ]
      },
      transformTags: {
        a: (tagName, attribs) => {
          let rel = 'noopener noreferrer'
          if (attribs.rel === 'me') rel += ' me'

          return {
            tagName,
            attribs: Object.assign(attribs, {
              target: '_blank',
              rel
            })
          }
        }
      }
    })
  }

  private async loadSanitizeHtml () {
    // FIXME: import('..') returns a struct module, containing a "default" field corresponding to our sanitizeHtml function
    this.sanitizeHtml = (await import('sanitize-html') as any).default
  }
}
