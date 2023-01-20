import { Injectable } from '@angular/core'
import { getAbsoluteAPIUrl } from '@app/helpers/utils'

@Injectable()
export class LinkifierService {
  static CLASSNAME = 'linkified'

  private linkifyModule: any
  private linkifyHtmlModule: any

  private linkifyOptions = {
    className: {
      mention: LinkifierService.CLASSNAME + '-mention',
      url: LinkifierService.CLASSNAME + '-url'
    },
    formatHref: {
      mention: (href: string) => {
        return getAbsoluteAPIUrl() + '/services/redirect/accounts/' + href.substring(1)
      }
    }
  }

  async linkify (text: string) {
    if (!this.linkifyModule) {
      const result = await Promise.all([
        import('linkifyjs'),
        import('linkify-plugin-mention'),
        import('linkify-html').then(m => (m as any).default)
      ])

      this.linkifyModule = result[0]
      this.linkifyHtmlModule = result[2]
    }

    return this.linkifyHtmlModule(text, this.linkifyOptions)
  }
}
