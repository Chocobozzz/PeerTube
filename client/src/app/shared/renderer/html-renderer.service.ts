import { Injectable } from '@angular/core'
import { LinkifierService } from '@app/shared/renderer/linkifier.service'

@Injectable()
export class HtmlRendererService {

  constructor (private linkifier: LinkifierService) {

  }

  async toSafeHtml (text: string) {
    // FIXME: import('..') returns a struct module, containing a "default" field corresponding to our sanitizeHtml function
    const sanitizeHtml: typeof import ('sanitize-html') = (await import('sanitize-html') as any).default

    // Convert possible markdown to html
    const html = this.linkifier.linkify(text)

    return sanitizeHtml(html, {
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
}
