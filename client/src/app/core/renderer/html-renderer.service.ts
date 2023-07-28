import { Injectable } from '@angular/core'
import { getCustomMarkupSanitizeOptions, getDefaultSanitizeOptions } from '@shared/core-utils/renderer/html'
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

  async toSafeHtml (text: string, additionalAllowedTags: string[] = []) {
    const [ html ] = await Promise.all([
      // Convert possible markdown to html
      this.linkifier.linkify(text),

      this.loadSanitizeHtml()
    ])

    const options = additionalAllowedTags.length !== 0
      ? getCustomMarkupSanitizeOptions(additionalAllowedTags)
      : getDefaultSanitizeOptions()

    return this.sanitizeHtml(html, options)
  }

  private async loadSanitizeHtml () {
    this.sanitizeHtml = (await import('sanitize-html')).default
  }
}
