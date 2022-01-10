import { Injectable } from '@angular/core'
import { LinkifierService } from './linkifier.service'
import { getCustomMarkupSanitizeOptions, getSanitizeOptions } from '@shared/core-utils/renderer/html'

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

  async toSafeHtml (text: string, additionalAllowedTags: string[] = []) {
    const [ html ] = await Promise.all([
      // Convert possible markdown to html
      this.linkifier.linkify(text),

      this.loadSanitizeHtml()
    ])

    const options = additionalAllowedTags.length !== 0
      ? getCustomMarkupSanitizeOptions(additionalAllowedTags)
      : getSanitizeOptions()

    return this.sanitizeHtml(html, options)
  }

  private async loadSanitizeHtml () {
    // FIXME: import('..') returns a struct module, containing a "default" field corresponding to our sanitizeHtml function
    this.sanitizeHtml = (await import('sanitize-html') as any).default
  }
}
