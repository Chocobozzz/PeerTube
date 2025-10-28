import { Injectable } from '@angular/core'
import { getAPIUrl } from '@app/helpers/utils'
import type LinkifyHTML from 'linkify-html'
import type * as LinkifyJS from 'linkifyjs'

@Injectable()
export class LinkifierService {
  static CLASSNAME = 'linkified'

  private linkifyModule: typeof LinkifyJS
  private linkifyHtmlModule: typeof LinkifyHTML

  private mentionPluginInitialized = false

  private linkifyOptions: LinkifyJS.Opts = {
    className: {
      mention: LinkifierService.CLASSNAME + '-mention',
      url: LinkifierService.CLASSNAME + '-url'
    },
    formatHref: {
      mention: (href: string) => {
        return getAPIUrl() + '/services/redirect/actors/' + href.substring(1)
      }
    }
  }

  async linkify (text: string) {
    if (!this.linkifyModule) {
      const result = await Promise.all([
        import('linkifyjs'),
        import('linkify-html').then(m => (m as any).default)
      ])

      this.linkifyModule = result[0]
      this.linkifyHtmlModule = result[1]

      this.buildMentionPlugin()
    }

    return this.linkifyHtmlModule(text, this.linkifyOptions)
  }

  private buildMentionPlugin () {
    if (this.mentionPluginInitialized) return

    const MentionToken = this.linkifyModule.createTokenClass('mention', {
      isLink: true,
      toHref () {
        return '/' + this.toString().slice(1)
      }
    })

    this.linkifyModule.registerPlugin('mention', ({ scanner, parser }) => {
      const { DOT, HYPHEN, UNDERSCORE, AT } = scanner.tokens
      const { domain } = scanner.tokens.groups

      // Start with @
      const At = parser.start.tt(AT)

      // Valid mention (not made up entirely of symbols)
      const Mention = At.tt(UNDERSCORE, MentionToken as any)

      At.ta(domain, Mention)
      At.tt(UNDERSCORE, Mention)

      // More valid mentions
      Mention.ta(domain, Mention)
      Mention.tt(HYPHEN, Mention)
      Mention.tt(UNDERSCORE, Mention)

      // ADDED: . transitions
      const MentionDot = Mention.tt(DOT)
      MentionDot.ta(domain, Mention)
      MentionDot.tt(HYPHEN, Mention)
      MentionDot.tt(UNDERSCORE, Mention)

      const MentionAt = Mention.tt(AT)
      MentionAt.ta(domain, Mention)
      MentionAt.tt(HYPHEN, Mention)
      MentionAt.tt(UNDERSCORE, Mention)
    })

    this.mentionPluginInitialized = true
  }
}
