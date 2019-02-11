import { Injectable } from '@angular/core'
import { LinkifierService } from '@app/shared/renderer/linkifier.service'
import * as sanitizeHtml from 'sanitize-html'

@Injectable()
export class HtmlRendererService {

  constructor (private linkifier: LinkifierService) {

  }

  toSafeHtml (text: string) {
    // Convert possible markdown to html
    const html = this.linkifier.linkify(text)

    return sanitizeHtml(html, {
      allowedTags: [ 'a', 'p', 'span', 'br' ],
      allowedSchemes: [ 'http', 'https' ],
      allowedAttributes: {
        'a': [ 'href', 'class', 'target' ]
      },
      transformTags: {
        a: (tagName, attribs) => {
          return {
            tagName,
            attribs: Object.assign(attribs, {
              target: '_blank',
              rel: 'noopener noreferrer'
            })
          }
        }
      }
    })
  }
}
